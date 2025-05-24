import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios'; // Added HttpModule
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller'; // For sending messages
import { WhatsAppWebhookController } from './whatsapp-webhook.controller'; // For receiving messages
import { TenantSurrealModule } from '../tenant-surreal/tenant-surreal.module';
import { ContactsModule } from '../contacts/contacts.module';
// AgUiModule is Global, so AgUiIntegrationService is available.

@Module({
  imports: [
    ConfigModule,
    HttpModule, // Added HttpModule for making external API calls
    TenantSurrealModule,
    ContactsModule,
    // AgUiModule is not needed here as it's global
  ],
  controllers: [
    WhatsAppController,         // Handles outgoing operations like sending messages
    WhatsAppWebhookController,  // Handles incoming webhooks from Baileys microservice
  ],
  providers: [
    WhatsAppService, // Refactored service, no longer depends on BaileysManagerService directly
  ],
  exports: [WhatsAppService], // Export WhatsAppService if other modules need to send messages
})
export class WhatsAppModule {}
