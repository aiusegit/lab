import { Injectable, Inject, NotFoundException, InternalServerErrorException, Logger, Scope, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import Surreal from 'surrealdb.js';
import { TENANT_SURREAL_CONNECTION } from '../tenant-surreal/tenant-surreal.module';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ContactsService } from '../contacts/contacts.service';
import { WhatsAppMessage } from './dto/whatsapp.dto'; // Existing DTO for DB
import { IncomingMessagePayload } from './dto/whatsapp-webhook.dto'; // New DTO for webhook
import { ConfigService } from '@nestjs/config';
import { Contact } from '../contacts/dto/contacts.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { jidNormalizedUser } from '@whiskeysockets/baileys'; // For normalizing our own JID if needed
import { AgUiIntegrationService } from '../ag-ui/ag-ui-integration.service';


@Injectable({ scope: Scope.REQUEST }) // Request-scoped for outgoing, but webhook processing is effectively singleton per call
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly baileysServiceUrl: string;
  private readonly baileysServiceApiKey: string;
  private readonly defaultBotJid = 'your_bot_jid@s.whatsapp.net'; // Placeholder, should be fetched or configured

  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly tenantDb: Surreal | null, // Nullable for webhook context
    private readonly tenantContextService: TenantContextService,
    private readonly contactsService: ContactsService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly agUiIntegrationService: AgUiIntegrationService, // For AG-UI events
  ) {
    this.baileysServiceUrl = this.configService.get<string>('BAILEYS_SERVICE_URL');
    this.baileysServiceApiKey = this.configService.get<string>('BAILEYS_SERVICE_API_KEY');
    const configuredBotJid = this.configService.get<string>('WHATSAPP_BOT_JID'); // Optional: configure your bot's JID
    if (configuredBotJid) {
        this.defaultBotJid = jidNormalizedUser(configuredBotJid);
    }
  }

  private ensureDbConnectionForTenant(tenantId: string): Surreal {
    // This is a simplified check for request-scoped injection.
    // For webhook, tenantDb might be null if service is instantiated outside tenant request scope.
    // getDbForTenant handles creating a new connection for webhook.
    if (this.tenantDb && this.tenantContextService.getTenantDetails()?.namespaceId?.includes(tenantId)) {
      return this.tenantDb;
    }
    this.logger.warn(`ensureDbConnectionForTenant: Tenant DB not available or context mismatch for tenant ${tenantId}. Consider using getDbForTenant for webhook processing.`);
    throw new InternalServerErrorException(`Database context not properly set for tenant ${tenantId} for this operation.`);
  }

  private async getDbForTenant(tenantId: string): Promise<Surreal> {
    const tempDb = new Surreal();
    try {
      // Assuming tenantId is the business ID, convert to NS format
      const tenantNs = `tenant_${tenantId.replace(/-/g, '_')}`;
      const tenantDbName = 'app_db'; // Standardized

      await tempDb.connect(this.configService.get<string>('TENANT_SURREALDB_URL'));
      const rootUser = this.configService.get<string>('TENANT_SURREALDB_ROOT_USER');
      const rootPass = this.configService.get<string>('TENANT_SURREALDB_ROOT_PASS');
      if (rootUser && rootPass) {
        await tempDb.signin({ user: rootUser, pass: rootPass });
      }
      await tempDb.use({ ns: tenantNs, db: tenantDbName });
      this.logger.log(`Successfully connected to DB for tenant ${tenantId} (ns: ${tenantNs}) for webhook processing.`);
      return tempDb;
    } catch (e) {
      this.logger.error(`Failed to create dynamic DB connection for tenant ${tenantId}: ${e.message}`);
      await tempDb.close(); // Ensure connection is closed on failure
      throw new InternalServerErrorException(`Could not establish DB connection for tenant ${tenantId}.`);
    }
  }

  async sendMessage(contactId: string, messageText: string): Promise<WhatsAppMessage> {
    const currentTenantId = this.tenantContextService.getTenantDetails().namespaceId?.replace('tenant_','');
    if (!currentTenantId) {
      throw new InternalServerErrorException('Tenant ID could not be determined for sending message.');
    }
    // Use ensureDbConnectionForTenant for operations within a request scope
    const db = this.ensureDbConnectionForTenant(currentTenantId);


    this.logger.log(`Attempting to send message to contact ${contactId} in tenant ${currentTenantId}.`);

    const contact = await this.contactsService.findOne(contactId);
    if (!contact || !contact.phone_number) {
      throw new NotFoundException(`Contact with ID ${contactId} not found or has no phone number.`);
    }

    let recipientJid = contact.phone_number.replace(/\D/g, '');
    if (!recipientJid.endsWith('@s.whatsapp.net')) {
      recipientJid = `${recipientJid}@s.whatsapp.net`;
    }
    recipientJid = jidNormalizedUser(recipientJid);

    if (!this.baileysServiceUrl || !this.baileysServiceApiKey) {
      this.logger.error('Baileys microservice URL or API Key is not configured.');
      throw new InternalServerErrorException('WhatsApp service is not configured.');
    }

    const url = `${this.baileysServiceUrl}/message/send`;
    const payload = { jid: recipientJid, text: messageText };
    const headers = { 'X-Api-Key': this.baileysServiceApiKey, 'Content-Type': 'application/json' };

    try {
      this.logger.debug(`Calling Baileys microservice at ${url} for JID ${recipientJid}`);
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers }),
      );

      this.logger.log(`Message sent via microservice to ${recipientJid}. Response: ${response.status}`);
      // Assuming microservice returns { success: true, messageId: string, status: any }

      const messageToStore: WhatsAppMessage = {
        message_id: response.data.messageId || `local_${Date.now()}`, // Use microservice's ID
        sender_jid: this.defaultBotJid, // Our bot's JID
        receiver_jid: recipientJid,
        contact_link: contact.id,
        content: messageText,
        message_type: 'text',
        status: 'sent', // Or map from response.data.status
        timestamp: new Date().toISOString(), // Microservice might provide a better timestamp
        direction: 'outbound',
        tenant_id: currentTenantId,
        created_at: new Date().toISOString(),
      };

      const createdRecords = await db.create<WhatsAppMessage>('whatsapp_messages', messageToStore);
      this.logger.log(`Outgoing message stored in DB with ID: ${Array.isArray(createdRecords) ? createdRecords[0].id : createdRecords.id}`);
      return Array.isArray(createdRecords) ? createdRecords[0] : createdRecords;

    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.isAxiosError) {
        this.logger.error(
          `Error calling Baileys microservice: ${axiosError.message}, Status: ${axiosError.response?.status}, Data: ${JSON.stringify(axiosError.response?.data)}`,
        );
        throw new HttpException(
          axiosError.response?.data || 'Failed to send message via Baileys service',
          axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      this.logger.error(`Generic error sending message: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to send message: ${error.message}`);
    }
  }

  async processIncomingWebhookMessage(payload: IncomingMessagePayload, tenantIdToProcessFor: string): Promise<void> {
    this.logger.log(`Processing incoming webhook message for tenant ${tenantIdToProcessFor}. Message ID: ${payload.messageId}`);
    let dbForTenant: Surreal | null = null;

    try {
      dbForTenant = await this.getDbForTenant(tenantIdToProcessFor);

      let messageContent = '';
      if (payload.content?.conversation) {
        messageContent = payload.content.conversation;
      } else if (payload.content?.extendedTextMessage?.text) {
        messageContent = payload.content.extendedTextMessage.text;
      } else {
        this.logger.debug(`Webhook message (ID: ${payload.messageId}) has no recognizable text content. Skipping storage.`);
        return; // Or handle other types like images, audio
      }

      if (!messageContent.trim()) {
        this.logger.debug(`Webhook message (ID: ${payload.messageId}) is empty. Skipping.`);
        return;
      }

      const plainPhoneNumber = payload.senderJid.split('@')[0];
      let contactLink: string | undefined = undefined;

      try {
        const contactsQuery = `SELECT id, first_name, last_name FROM contacts WHERE string::replace(phone_number, /\\D/g, "") = $number LIMIT 1;`;
        const contactResult = await dbForTenant.query<[Contact[]]>(contactsQuery, { number: plainPhoneNumber });
        const foundContact = contactResult[0]?.result?.[0];

        if (foundContact) {
          contactLink = foundContact.id;
          this.logger.log(`Found matching contact ${contactLink} for sender ${payload.senderJid} in tenant ${tenantIdToProcessFor}.`);
        } else {
          this.logger.log(`No matching contact for sender ${payload.senderJid} (phone: ${plainPhoneNumber}) in tenant ${tenantIdToProcessFor}.`);
          // Optional: Create a new contact here if desired by business logic.
        }
      } catch (contactError) {
        this.logger.error(`Error looking up contact for ${plainPhoneNumber} in tenant ${tenantIdToProcessFor}: ${contactError.message}`);
      }

      const messageToStore: WhatsAppMessage = {
        message_id: payload.messageId,
        sender_jid: jidNormalizedUser(payload.senderJid),
        receiver_jid: this.defaultBotJid, // Our bot's JID
        contact_link: contactLink,
        content: messageContent,
        message_type: 'text', // Assuming text for now
        status: 'received',
        timestamp: new Date(payload.messageTimestamp * 1000).toISOString(),
        direction: 'inbound',
        tenant_id: tenantIdToProcessFor,
        created_at: new Date().toISOString(),
      };

      const createdRecords = await dbForTenant.create<WhatsAppMessage>('whatsapp_messages', messageToStore);
      const dbId = Array.isArray(createdRecords) ? createdRecords[0].id : createdRecords.id;
      this.logger.log(`Incoming message from ${payload.senderJid} stored in DB for tenant ${tenantIdToProcessFor}. DB ID: ${dbId}`);

      // Emit AG-UI event for new incoming message
      this.agUiIntegrationService.publishEvent(
        'whatsapp_message_received',
        {
          dbId: dbId,
          message: messageToStore, // Send the stored message object
          contactId: contactLink,
          sender: payload.senderJid,
          pushName: payload.pushName,
        },
        tenantIdToProcessFor
      ).catch(err => this.logger.error(`Error publishing AG-UI event for incoming WhatsApp message: ${err.message}`));


    } catch (error) {
      this.logger.error(`Error in processIncomingWebhookMessage for tenant ${tenantIdToProcessFor}: ${error.message}`, error.stack);
      // Do not rethrow, as this is a webhook handler. Log and absorb.
    } finally {
      if (dbForTenant) {
        await dbForTenant.close();
        this.logger.debug(`Closed temporary DB connection for tenant ${tenantIdToProcessFor} after webhook processing.`);
      }
    }
  }
}
