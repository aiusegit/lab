import { Injectable, Inject, NotFoundException, InternalServerErrorException, Logger, Scope, BadRequestException, OnModuleInit } from '@nestjs/common';
import Surreal, { RecordId } from 'surrealdb.js';
import { TENANT_SURREAL_CONNECTION } from '../tenant-surreal/tenant-surreal.module';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ContactsService } from '../contacts/contacts.service';
import { BaileysManagerService } from './baileys-manager.service';
import { WAMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { WhatsAppMessage } from './dto/whatsapp.dto';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../contacts/dto/contacts.dto'; // Assuming Contact interface

@Injectable({ scope: Scope.REQUEST }) // Request-scoped to handle tenant context for outgoing messages
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private defaultTenantIdForIncoming: string;

  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly tenantDb: Surreal | null,
    private readonly tenantContextService: TenantContextService, // For outgoing messages
    private readonly contactsService: ContactsService, // This will be request-scoped, so it uses current tenant context
    private readonly baileysManager: BaileysManagerService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTenantIdForIncoming = this.configService.get<string>('DEFAULT_TENANT_ID_FOR_WHATSAPP_INCOMING');
    if (!this.defaultTenantIdForIncoming) {
      this.logger.warn('DEFAULT_TENANT_ID_FOR_WHATSAPP_INCOMING is not set in .env. Incoming messages might not be processed correctly.');
    }
  }

  async onModuleInit() {
    this.logger.log('WhatsAppService initialized. Subscribing to incoming messages from BaileysManager.');
    this.baileysManager.incomingMessage$.subscribe(async ({ message, rawEvents }) => {
      try {
        // MVP Limitation: Using defaultTenantIdForIncoming for handling all incoming messages.
        // In a full multi-tenant Baileys setup, this would need to be more sophisticated,
        // possibly routing messages based on the connected WhatsApp number if multiple clients are managed,
        // or having a dedicated DB connection for the default tenant here.
        if (!this.defaultTenantIdForIncoming) {
            this.logger.error('Cannot handle incoming message: DEFAULT_TENANT_ID_FOR_WHATSAPP_INCOMING is not configured.');
            return;
        }
        await this.handleIncomingMessage(message, rawEvents, this.defaultTenantIdForIncoming);
      } catch (error) {
        this.logger.error(`Error processing incoming message: ${error.message}`, error.stack);
      }
    });
  }

  private ensureDbConnection(): Surreal {
    if (!this.tenantDb) {
      this.logger.error('Tenant database connection is not available for an outgoing operation.');
      throw new InternalServerErrorException('Tenant database connection is not available.');
    }
    return this.tenantDb;
  }

  // Helper to get a DB connection for a specific tenant (used for incoming messages)
  private async getDbForTenant(tenantId: string): Promise<Surreal> {
    // This is a simplified approach. In a real scenario, you might have a pool of connections
    // or a way to dynamically instantiate a Surreal client for a specific tenant's NS/DB
    // based on master DB lookup, similar to how TenantSurrealModule factory works.
    // For MVP, assuming the tenantDb injected in constructor might be usable IF this service
    // was instantiated within that tenant's request scope. But for incoming messages, it's not.
    // So, we'll create a new connection or throw error.
    
    // This is a placeholder. Proper dynamic connection for a specific tenant is complex
    // outside a request scope and might require a dedicated service.
    // For now, if current tenantDb matches default, use it, otherwise error.
    const currentTenantDetails = this.tenantContextService.getTenantDetails();
    const masterDbUrl = this.configService.get<string>('MASTER_SURREALDB_URL'); // Assuming master can provide details
    const rootUser = this.configService.get<string>('TENANT_SURREALDB_ROOT_USER');
    const rootPass = this.configService.get<string>('TENANT_SURREALDB_ROOT_PASS');

    // TODO: Fetch tenant's ns/db from master DB using tenantId (business ID)
    // This part is crucial and needs a service similar to TenantsService but callable from a singleton context.
    // For MVP, this will be a major simplification / hardcoding if not careful.
    // Let's assume for now we can't get a dynamic DB connection easily here and rely on an external mechanism
    // to ensure the "defaultTenantIdForIncoming" context is somehow set for the DB.
    // This is a significant simplification for the MVP.
    
    // A more robust (but still simplified) approach for MVP:
    // Use the globally configured TENANT_SURREALDB_URL and root credentials, then `USE NS/DB`.
    // This is only safe if the `defaultTenantIdForIncoming` corresponds to a NS/DB that the root user can access.
    const tempDb = new Surreal();
    try {
        const tenantNs = `tenant_${tenantId.replace(/-/g, '_')}`; // Assuming a convention
        const tenantDbName = 'app_db'; // Assuming a convention

        await tempDb.connect(this.configService.get<string>('TENANT_SURREALDB_URL'));
        if (rootUser && rootPass) {
            await tempDb.signin({user: rootUser, pass: rootPass});
        }
        await tempDb.use({ns: tenantNs, db: tenantDbName});
        this.logger.log(`Successfully connected to DB for tenant ${tenantId} (ns: ${tenantNs}) for incoming message handling.`);
        return tempDb;
    } catch(e) {
        this.logger.error(`Failed to create dynamic DB connection for tenant ${tenantId}: ${e.message}`);
        await tempDb.close();
        throw new InternalServerErrorException(`Could not establish DB connection for tenant ${tenantId} to handle incoming message.`);
    }
  }


  async sendMessage(contactId: string, messageText: string): Promise<WhatsAppMessage> {
    const db = this.ensureDbConnection(); // Uses current request's tenant context
    const currentTenantId = this.tenantContextService.getTenantDetails().namespaceId?.replace('tenant_',''); // Business ID

    if (!currentTenantId) {
        throw new InternalServerErrorException('Tenant ID could not be determined for sending message.');
    }

    this.logger.log(`Attempting to send message to contact ${contactId} in tenant ${currentTenantId}.`);

    const contact = await this.contactsService.findOne(contactId); // Uses request-scoped ContactsService
    if (!contact || !contact.phone_number) {
      throw new NotFoundException(`Contact with ID ${contactId} not found or has no phone number.`);
    }

    const sock = await this.baileysManager.getSocket();
    if (!sock) {
      throw new InternalServerErrorException('WhatsApp client is not connected.');
    }

    // Format JID: ensure it's example@s.whatsapp.net
    // Assuming phone_number is stored as plain digits or with country code.
    // Baileys usually expects JIDs like '1234567890@s.whatsapp.net'
    let recipientJid = contact.phone_number.replace(/\D/g, ''); // Remove non-digits
    if (!recipientJid.endsWith('@s.whatsapp.net')) {
      recipientJid = `${recipientJid}@s.whatsapp.net`;
    }
    recipientJid = jidNormalizedUser(recipientJid); // Normalize JID

    this.logger.log(`Sending message to JID: ${recipientJid}`);

    try {
      const waMessage = await sock.sendMessage(recipientJid, { text: messageText });
      this.logger.log(`Message sent successfully to ${recipientJid}. Message ID: ${waMessage.key.id}`);

      const messageToStore: WhatsAppMessage = {
        message_id: waMessage.key.id!,
        sender_jid: jidNormalizedUser(sock.user!.id), // Our bot's JID
        receiver_jid: recipientJid,
        contact_link: contact.id, // Link to CRM contact
        content: messageText,
        message_type: 'text',
        status: 'sent', // Or 'delivered' if we get immediate confirmation
        timestamp: new Date(waMessage.messageTimestamp! as number * 1000).toISOString(),
        direction: 'outbound',
        tenant_id: currentTenantId,
        created_at: new Date().toISOString(),
      };

      const createdRecords = await db.create<WhatsAppMessage>('whatsapp_messages', messageToStore);
      this.logger.log(`Outgoing message stored in DB with ID: ${Array.isArray(createdRecords) ? createdRecords[0].id : createdRecords.id}`);
      return Array.isArray(createdRecords) ? createdRecords[0] : createdRecords;
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message or storing it: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to send message: ${error.message}`);
    }
  }

  async handleIncomingMessage(message: WAMessage, rawMessageEvents: any, processingTenantId: string): Promise<void> {
    this.logger.log(`Handling incoming message for tenant ${processingTenantId}: ${JSON.stringify(message)}`);
    let tempDbForTenant: Surreal | null = null;

    try {
      tempDbForTenant = await this.getDbForTenant(processingTenantId);

      const senderJid = message.key.remoteJid;
      if (!senderJid || message.key.fromMe) {
        this.logger.debug('Incoming message is from self or sender JID is missing. Skipping.');
        if (tempDbForTenant) await tempDbForTenant.close();
        return;
      }
      
      // Extract message content (simplified for text messages)
      let messageContent = '';
      if (message.message?.conversation) {
        messageContent = message.message.conversation;
      } else if (message.message?.extendedTextMessage?.text) {
        messageContent = message.message.extendedTextMessage.text;
      } else {
        this.logger.debug(`Received message (ID: ${message.key.id}) with no recognizable text content. Skipping.`);
        if (tempDbForTenant) await tempDbForTenant.close();
        return;
      }

      if (!messageContent.trim()) {
        this.logger.debug(`Received empty message (ID: ${message.key.id}). Skipping.`);
        if (tempDbForTenant) await tempDbForTenant.close();
        return;
      }
      
      this.logger.log(`Processing message from ${senderJid} for tenant ${processingTenantId}. Content: "${messageContent}"`);

      // Attempt to find contact by phone number (JID without @s.whatsapp.net)
      const plainPhoneNumber = senderJid.split('@')[0];
      let contactLink: string | undefined = undefined;

      try {
        // Query contacts table for this phone number within the specific tenant's DB
        const contactsQuery = `SELECT * FROM contacts WHERE string::replace(phone_number, /\\D/g, "") = $number LIMIT 1;`;
        const contactResult = await tempDbForTenant.query<[Contact[]]>(contactsQuery, { number: plainPhoneNumber });
        const foundContact = contactResult[0]?.result?.[0];

        if (foundContact) {
          contactLink = foundContact.id;
          this.logger.log(`Found matching contact ${contactLink} for sender ${senderJid} in tenant ${processingTenantId}.`);
        } else {
          this.logger.log(`No matching contact found for sender ${senderJid} (phone: ${plainPhoneNumber}) in tenant ${processingTenantId}. Message will be stored without contact link.`);
          // Optionally, create a new contact here if desired.
        }
      } catch (contactError) {
          this.logger.error(`Error looking up contact for ${plainPhoneNumber} in tenant ${processingTenantId}: ${contactError.message}`);
      }


      const messageToStore: WhatsAppMessage = {
        message_id: message.key.id!,
        sender_jid: jidNormalizedUser(senderJid),
        receiver_jid: jidNormalizedUser(this.baileysManager.getWhatsAppJid() || 'unknown@s.whatsapp.net'), // Our bot's JID
        contact_link: contactLink,
        content: messageContent,
        message_type: 'text', // Assuming text for MVP
        status: 'received',
        timestamp: new Date((message.messageTimestamp as number) * 1000).toISOString(),
        direction: 'inbound',
        tenant_id: processingTenantId,
        created_at: new Date().toISOString(),
      };

      const createdRecords = await tempDbForTenant.create<WhatsAppMessage>('whatsapp_messages', messageToStore);
      this.logger.log(`Incoming message from ${senderJid} stored in DB for tenant ${processingTenantId}. DB ID: ${Array.isArray(createdRecords) ? createdRecords[0].id : createdRecords.id}`);
    
    } catch (error) {
      this.logger.error(`Error in handleIncomingMessage for tenant ${processingTenantId}: ${error.message}`, error.stack);
    } finally {
        if (tempDbForTenant) {
            await tempDbForTenant.close();
            this.logger.debug(`Closed temporary DB connection for tenant ${processingTenantId} after handling incoming message.`);
        }
    }
  }
}
