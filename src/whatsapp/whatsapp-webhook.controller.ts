import { Controller, Post, Body, UseGuards, Logger, HttpCode, HttpStatus, Injectable, Scope, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { IncomingMessagePayload } from './dto/whatsapp-webhook.dto';
import { HeaderApiKeyAuthGuard } from '../auth/guards/header-api-key.guard';
import { ModuleRef } from '@nestjs/core';

// Custom Guard specifically for Baileys Webhook, configuring HeaderApiKeyAuthGuard
@Injectable()
export class BaileysWebhookGuard extends HeaderApiKeyAuthGuard {
  constructor(configService: ConfigService) {
    super(configService, 'BAILEYS_WEBHOOK_API_KEY'); // Pass the specific env var name
  }
}


@Controller('api/whatsapp/webhook') // Path prefix to match NESTJS_WEBHOOK_URL
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly defaultTenantIdForIncoming: string;

  constructor(
    // WhatsAppService is request-scoped, but this controller is singleton.
    // We need to either make WhatsAppService singleton (not ideal if it uses TENANT_SURREAL_CONNECTION for other methods)
    // or resolve it dynamically, or pass necessary context.
    // For webhook processing, WhatsAppService.processIncomingWebhookMessage is designed to create its own DB connection.
    private readonly whatsAppService: WhatsAppService, // This will be resolved from the DI container
    private readonly configService: ConfigService,
  ) {
    this.defaultTenantIdForIncoming = this.configService.get<string>('DEFAULT_TENANT_ID_FOR_WHATSAPP_INCOMING');
    if (!this.defaultTenantIdForIncoming) {
      this.logger.error('CRITICAL: DEFAULT_TENANT_ID_FOR_WHATSAPP_INCOMING is not set. Webhooks cannot be processed.');
      // Depending on strictness, might throw an error during app startup in a real scenario
    }
  }

  @Post('incoming')
  @UseGuards(BaileysWebhookGuard) // Protect this endpoint
  @HttpCode(HttpStatus.OK) // Respond 200 OK quickly
  async handleIncomingMessage(@Body() payload: IncomingMessagePayload): Promise<{ message: string }> {
    this.logger.log(`Received incoming WhatsApp message webhook for message ID: ${payload.messageId} from ${payload.senderJid}`);

    if (!this.defaultTenantIdForIncoming) {
      this.logger.error('Cannot process webhook: DEFAULT_TENANT_ID_FOR_WHATSAPP_INCOMING is not configured.');
      // Return OK to webhook sender to prevent retries, but log error.
      return { message: 'Webhook received, but server configuration error for default tenant.' };
    }
    
    // Asynchronously process the message. Do not await here to ensure a quick response.
    // The WhatsAppService.processIncomingWebhookMessage method is designed to be self-contained
    // for webhook processing, including creating its own DB connection for the default tenant.
    this.whatsAppService.processIncomingWebhookMessage(payload, this.defaultTenantIdForIncoming)
      .then(() => {
        this.logger.log(`Successfully queued processing for message ID: ${payload.messageId}`);
      })
      .catch(err => {
        this.logger.error(`Error queuing/processing webhook message ID ${payload.messageId}: ${err.message}`, err.stack);
      });

    return { message: 'Webhook received and queued for processing.' };
  }
}
