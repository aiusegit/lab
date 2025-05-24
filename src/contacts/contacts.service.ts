import { Injectable, Inject, NotFoundException, InternalServerErrorException, Logger, Scope, BadRequestException } from '@nestjs/common';
import Surreal from 'surrealdb.js';
import { TENANT_SURREAL_CONNECTION } from '../tenant-surreal/tenant-surreal.module';
import { CreateContactDto, UpdateContactDto, Contact } from './dto/contacts.dto';
import { TenantContextService } from '../tenant-context/tenant-context.service'; // To get tenant_id if needed for records

@Injectable({ scope: Scope.REQUEST })
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly tenantDb: Surreal | null,
    private readonly tenantContextService: TenantContextService,
  ) {
    if (!this.tenantDb) {
      this.logger.error(`${ContactsService.name} initialized without a tenant DB connection.`);
      throw new InternalServerErrorException('Tenant database connection is not available for ContactsService.');
    }
  }

  private ensureDbConnection(): Surreal {
    if (!this.tenantDb) {
      this.logger.error('Tenant database connection is not available.');
      throw new InternalServerErrorException('Tenant database connection is not available.');
    }
    return this.tenantDb;
  }

  async create(createContactDto: CreateContactDto, createdByUserId?: string): Promise<Contact> {
    const db = this.ensureDbConnection();
    const { assigned_to_user_id, ...contactData } = createContactDto;

    const newContactData: any = {
      ...contactData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (createdByUserId) {
      // Ensure createdByUserId is a valid record link format if it's not already
      newContactData.created_by_user_id = createdByUserId.includes(':') ? createdByUserId : `users:${createdByUserId}`;
    }

    if (assigned_to_user_id) {
      if (!assigned_to_user_id.includes(':')) {
        throw new BadRequestException('assigned_to_user_id must be a valid SurrealDB record ID (e.g., users:id).');
      }
      // Basic validation: check if user exists (optional, could be strict)
      // const assignedUser = await db.select(assigned_to_user_id);
      // if (!assignedUser) {
      //   throw new NotFoundException(`Assigned user with ID ${assigned_to_user_id} not found.`);
      // }
      newContactData.assigned_to_user_id = assigned_to_user_id;
    }
    
    this.logger.log(`Attempting to create contact with data: ${JSON.stringify(newContactData)}`);

    try {
      const createdRecords = await db.create<Contact>('contacts', newContactData);
      const createdContact = Array.isArray(createdRecords) ? createdRecords[0] : createdRecords;
      this.logger.log(`Contact created successfully with ID: ${createdContact.id}`);
      return createdContact;
    } catch (error) {
      this.logger.error(`Error creating contact: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create contact: ${error.message}`);
    }
  }

  async findAll(): Promise<Contact[]> {
    const db = this.ensureDbConnection();
    this.logger.log('Fetching all contacts for the tenant.');
    try {
      const contacts = await db.select<Contact[]>('contacts');
      this.logger.log(`Found ${contacts.length} contacts.`);
      return contacts;
    } catch (error) {
      this.logger.error(`Error fetching all contacts: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch contacts: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Contact | null> {
    const db = this.ensureDbConnection();
    // Ensure id is just the UUID part for the query if `contacts:${id}` is the record ID format
    const recordId = id.includes(':') ? id : `contacts:${id}`;
    this.logger.log(`Fetching contact with ID: ${recordId}`);

    try {
      const contact = await db.select<Contact>(recordId);
      if (!contact || Object.keys(contact).length === 0 || !contact.id) { // Check if contact is empty or essentially null
        this.logger.warn(`Contact with ID ${recordId} not found.`);
        throw new NotFoundException(`Contact with ID ${recordId} not found.`);
      }
      this.logger.log(`Contact found: ${contact.id}`);
      return contact;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching contact ${recordId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch contact ${recordId}: ${error.message}`);
    }
  }

  async update(id: string, updateContactDto: UpdateContactDto): Promise<Contact | null> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `contacts:${id}`;
    this.logger.log(`Attempting to update contact with ID: ${recordId}`);

    // Ensure contact exists before attempting update
    const existingContact = await this.findOne(recordId); // findOne throws NotFoundException if not found

    const updateData = {
      ...updateContactDto,
      updated_at: new Date().toISOString(),
    };

    if (updateContactDto.assigned_to_user_id && !updateContactDto.assigned_to_user_id.includes(':')) {
        throw new BadRequestException('assigned_to_user_id must be a valid SurrealDB record ID (e.g., users:id).');
    }

    try {
      // SurrealDB's merge deep updates the record.
      const updatedRecords = await db.merge<Contact>(recordId, updateData);
      const updatedContact = Array.isArray(updatedRecords) ? updatedRecords[0] : updatedRecords;

      if (!updatedContact || !updatedContact.id) {
         this.logger.warn(`Contact with ID ${recordId} not found after update attempt, possibly due to merge behavior on non-existent ID.`);
         throw new NotFoundException(`Contact with ID ${recordId} not found or update failed.`);
      }
      this.logger.log(`Contact ${recordId} updated successfully.`);
      return updatedContact;
    } catch (error) {
      this.logger.error(`Error updating contact ${recordId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to update contact ${recordId}: ${error.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `contacts:${id}`;
    this.logger.log(`Attempting to delete contact with ID: ${recordId}`);

    // Ensure contact exists before attempting delete
    await this.findOne(recordId); // findOne throws NotFoundException if not found

    try {
      await db.delete(recordId);
      this.logger.log(`Contact ${recordId} deleted successfully.`);
    } catch (error) {
      this.logger.error(`Error deleting contact ${recordId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to delete contact ${recordId}: ${error.message}`);
    }
  }
}
