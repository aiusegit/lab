import { Injectable, Inject, NotFoundException, InternalServerErrorException, Logger, Scope, BadRequestException } from '@nestjs/common';
import Surreal from 'surrealdb.js';
import { TENANT_SURREAL_CONNECTION } from '../tenant-surreal/tenant-surreal.module';
import { CreateDealDto, UpdateDealDto, Deal } from './dto/deals.dto';
import { TenantContextService } from '../tenant-context/tenant-context.service';

@Injectable({ scope: Scope.REQUEST })
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly tenantDb: Surreal | null,
    private readonly tenantContextService: TenantContextService,
  ) {
    if (!this.tenantDb) {
      this.logger.error(`${DealsService.name} initialized without a tenant DB connection.`);
      throw new InternalServerErrorException('Tenant database connection is not available for DealsService.');
    }
  }

  private ensureDbConnection(): Surreal {
    if (!this.tenantDb) {
      this.logger.error('Tenant database connection is not available.');
      throw new InternalServerErrorException('Tenant database connection is not available.');
    }
    return this.tenantDb;
  }

  private async validateRecordExists(db: Surreal, recordId: string, recordType: string): Promise<void> {
    if (!recordId.includes(':')) {
      throw new BadRequestException(`${recordType} ID must be a valid SurrealDB record ID (e.g., table:id).`);
    }
    // Basic validation by trying to select the record.
    // More sophisticated validation might involve checking the record's type/table.
    const record = await db.select(recordId);
    if (!record || Object.keys(record).length === 0 || !record.id) {
      throw new NotFoundException(`${recordType} with ID ${recordId} not found.`);
    }
    this.logger.debug(`${recordType} with ID ${recordId} validated successfully.`);
  }

  async create(createDealDto: CreateDealDto, createdByUserId?: string): Promise<Deal> {
    const db = this.ensureDbConnection();
    const { contact_id, kanban_column_id, assigned_to_user_id, ...dealData } = createDealDto;

    // Validate foreign key existence
    await this.validateRecordExists(db, contact_id, 'Contact');
    await this.validateRecordExists(db, kanban_column_id, 'Kanban Column');
    if (assigned_to_user_id) {
      await this.validateRecordExists(db, assigned_to_user_id, 'Assigned User');
    }

    const newDealData: any = {
      ...dealData,
      contact_id,
      kanban_column_id,
      status: 'open', // Default status, might be derived from kanban_column_id later
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (createdByUserId) {
      newDealData.created_by_user_id = createdByUserId.includes(':') ? createdByUserId : `users:${createdByUserId}`;
    }
    if (assigned_to_user_id) {
      newDealData.assigned_to_user_id = assigned_to_user_id;
    }

    this.logger.log(`Attempting to create deal with data: ${JSON.stringify(newDealData)}`);

    try {
      const createdRecords = await db.create<Deal>('deals', newDealData);
      const createdDeal = Array.isArray(createdRecords) ? createdRecords[0] : createdRecords;
      this.logger.log(`Deal created successfully with ID: ${createdDeal.id}`);
      return createdDeal;
    } catch (error) {
      this.logger.error(`Error creating deal: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to create deal: ${error.message}`);
    }
  }

  async findAll(): Promise<Deal[]> {
    const db = this.ensureDbConnection();
    this.logger.log('Fetching all deals for the tenant.');
    try {
      // Example of fetching deals with related contact names using live functions or graph queries if needed
      // For simple CRUD, direct select is fine.
      // const deals = await db.query<Deal[]>("SELECT id, name, value, currency, contact_id, (SELECT name FROM ONLY contact_id) AS contact_name, stage_id, assigned_to_user_id, created_by_user_id, expected_close_date, status, created_at, updated_at FROM deals");
      // return deals[0]?.result || [];
      const deals = await db.select<Deal[]>('deals');
      this.logger.log(`Found ${deals.length} deals.`);
      return deals;
    } catch (error) {
      this.logger.error(`Error fetching all deals: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch deals: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Deal | null> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `deals:${id}`;
    this.logger.log(`Fetching deal with ID: ${recordId}`);

    try {
      const deal = await db.select<Deal>(recordId);
      if (!deal || Object.keys(deal).length === 0 || !deal.id) {
        this.logger.warn(`Deal with ID ${recordId} not found.`);
        throw new NotFoundException(`Deal with ID ${recordId} not found.`);
      }
      this.logger.log(`Deal found: ${deal.id}`);
      return deal;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching deal ${recordId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch deal ${recordId}: ${error.message}`);
    }
  }

  async update(id: string, updateDealDto: UpdateDealDto): Promise<Deal | null> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `deals:${id}`;
    this.logger.log(`Attempting to update deal with ID: ${recordId}`);

    await this.findOne(recordId); // Ensure deal exists

    const { contact_id, kanban_column_id, assigned_to_user_id, ...dealData } = updateDealDto;

    if (contact_id) await this.validateRecordExists(db, contact_id, 'Contact');
    if (kanban_column_id) await this.validateRecordExists(db, kanban_column_id, 'Kanban Column');
    if (assigned_to_user_id) await this.validateRecordExists(db, assigned_to_user_id, 'Assigned User');
    
    const updateData = {
      ...dealData,
      updated_at: new Date().toISOString(),
    };
    if (contact_id) updateData['contact_id'] = contact_id;
    if (kanban_column_id) updateData['kanban_column_id'] = kanban_column_id;
    if (assigned_to_user_id) updateData['assigned_to_user_id'] = assigned_to_user_id;


    try {
      const updatedRecords = await db.merge<Deal>(recordId, updateData);
      const updatedDeal = Array.isArray(updatedRecords) ? updatedRecords[0] : updatedRecords;

      if (!updatedDeal || !updatedDeal.id) {
         this.logger.warn(`Deal with ID ${recordId} not found after update attempt.`);
         throw new NotFoundException(`Deal with ID ${recordId} not found or update failed.`);
      }
      this.logger.log(`Deal ${recordId} updated successfully.`);
      return updatedDeal;
    } catch (error) {
      this.logger.error(`Error updating deal ${recordId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to update deal ${recordId}: ${error.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `deals:${id}`;
    this.logger.log(`Attempting to delete deal with ID: ${recordId}`);

    await this.findOne(recordId); // Ensure deal exists

    try {
      await db.delete(recordId);
      this.logger.log(`Deal ${recordId} deleted successfully.`);
    } catch (error) {
      this.logger.error(`Error deleting deal ${recordId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to delete deal ${recordId}: ${error.message}`);
    }
  }
}
