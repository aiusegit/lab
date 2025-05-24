import { Injectable, Inject, NotFoundException, InternalServerErrorException, Logger, Scope, BadRequestException } from '@nestjs/common';
import Surreal from 'surrealdb.js';
import { TENANT_SURREAL_CONNECTION } from '../tenant-surreal/tenant-surreal.module';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { Deal } from '../deals/dto/deals.dto'; // Assuming Deal interface is exported from deals module
import { KanbanColumn, KanbanColumnWithDeals, CreateKanbanColumnDto, UpdateKanbanColumnDto } from './dto/kanban.dto';
import { AgUiIntegrationService } from '../ag-ui/ag-ui-integration.service'; // Added AG-UI Service

@Injectable({ scope: Scope.REQUEST })
export class KanbanService {
  private readonly logger = new Logger(KanbanService.name);

  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly tenantDb: Surreal | null,
    private readonly tenantContextService: TenantContextService,
    private readonly agUiIntegrationService: AgUiIntegrationService, // Injected AG-UI Service
  ) {
    if (!this.tenantDb) {
      this.logger.error(`${KanbanService.name} initialized without a tenant DB connection.`);
      throw new InternalServerErrorException('Tenant database connection is not available for KanbanService.');
    }
  }

  private ensureDbConnection(): Surreal {
    if (!this.tenantDb) {
      this.logger.error('Tenant database connection is not available.');
      throw new InternalServerErrorException('Tenant database connection is not available.');
    }
    return this.tenantDb;
  }

  private async validateRecordExists(db: Surreal, recordId: string, recordType: string, expectedTable?: string): Promise<any> {
    if (!recordId.includes(':')) {
      throw new BadRequestException(`${recordType} ID "${recordId}" must be a valid SurrealDB record ID (e.g., table:id).`);
    }
    if (expectedTable && !recordId.startsWith(`${expectedTable}:`)) {
        throw new BadRequestException(`${recordType} ID "${recordId}" must belong to the table "${expectedTable}".`);
    }
    const record = await db.select(recordId);
    if (!record || Object.keys(record).length === 0 || !record.id) {
      throw new NotFoundException(`${recordType} with ID ${recordId} not found.`);
    }
    this.logger.debug(`${recordType} with ID ${recordId} validated successfully.`);
    return record;
  }

  async getKanbanBoardData(): Promise<KanbanColumnWithDeals[]> {
    const db = this.ensureDbConnection();
    this.logger.log('Fetching Kanban board data for the tenant.');

    try {
      // 1. Fetch all kanban_columns ordered by 'order'
      // Assuming board_type is 'deals' or not set for general columns
      const columnsQuery = `SELECT * FROM kanban_columns ORDER BY \`order\` ASC;`;
      const columnsResult = await db.query<[KanbanColumn[]]>(columnsQuery);
      const columns = columnsResult[0]?.result || [];

      if (columns.length === 0) {
        this.logger.log('No Kanban columns found for this tenant.');
        return [];
      }
      
      this.logger.log(`Found ${columns.length} Kanban columns.`);

      // 2. For each column, fetch its deals
      const boardData: KanbanColumnWithDeals[] = [];
      for (const column of columns) {
        const dealsQuery = `SELECT * FROM deals WHERE kanban_column_id = $columnId ORDER BY created_at DESC;`;
        const dealsResult = await db.query<[Deal[]]>(dealsQuery, { columnId: column.id });
        const dealsForColumn = dealsResult[0]?.result || [];
        boardData.push({
          ...column,
          deals: dealsForColumn,
        });
        this.logger.debug(`Fetched ${dealsForColumn.length} deals for column ${column.id} (${column.name})`);
      }

      this.logger.log('Successfully fetched Kanban board data.');
      return boardData;
    } catch (error) {
      this.logger.error(`Error fetching Kanban board data: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch Kanban board data: ${error.message}`);
    }
  }

  async updateDealKanbanColumn(dealId: string, newKanbanColumnId: string): Promise<Deal> {
    const db = this.ensureDbConnection();
    this.logger.log(`Attempting to update Kanban column for deal ${dealId} to ${newKanbanColumnId}.`);

    const dealRecordId = dealId.includes(':') ? dealId : `deals:${dealId}`;
    const columnRecordId = newKanbanColumnId.includes(':') ? newKanbanColumnId : `kanban_columns:${newKanbanColumnId}`;

    // Validate existence of the deal and the new kanban column
    const deal = await this.validateRecordExists(db, dealRecordId, 'Deal', 'deals') as Deal;
    await this.validateRecordExists(db, columnRecordId, 'Kanban Column', 'kanban_columns');

    if (deal.kanban_column_id === columnRecordId) {
        this.logger.log(`Deal ${dealRecordId} is already in column ${columnRecordId}. No update needed.`);
        return deal;
    }

    const updateData = {
      kanban_column_id: columnRecordId,
      updated_at: new Date().toISOString(),
    };

    try {
      const updatedRecords = await db.merge<Deal>(dealRecordId, updateData);
      const updatedDeal = Array.isArray(updatedRecords) ? updatedRecords[0] : updatedRecords;

      if (!updatedDeal || !updatedDeal.id) {
         this.logger.warn(`Deal with ID ${dealRecordId} not found after update attempt.`);
         throw new NotFoundException(`Deal with ID ${dealRecordId} not found or update failed.`);
      }
      this.logger.log(`Deal ${dealRecordId} successfully moved to Kanban column ${columnRecordId}.`);

      // Publish AG-UI event
      const currentTenantDetails = this.tenantContextService.getTenantDetails();
      // Assuming namespaceId is like 'tenant_businessid' or just 'businessid' if master DB stores it directly
      // For this example, let's assume tenantContextService.getNamespaceId() gives something from which business ID can be derived
      // Or, if the tenant_id is stored directly in TenantContextService (e.g. from JWT claim)
      let businessTenantId = currentTenantDetails.namespaceId; // Placeholder, adjust as per actual TenantContext structure
      if (businessTenantId && businessTenantId.startsWith('tenant_')) {
        businessTenantId = businessTenantId.replace('tenant_', '');
      }
      
      if (businessTenantId) {
        this.agUiIntegrationService.publishEvent(
          'deal_stage_updated',
          { 
            dealId: updatedDeal.id, // Send SurrealDB record ID
            newKanbanColumnId: updatedDeal.kanban_column_id, // Send SurrealDB record ID
            // Potentially add more deal context if useful for subscribers
            dealName: updatedDeal.name, 
            // oldKanbanColumnId: deal.kanban_column_id, // Original column before update
          },
          businessTenantId,
        ).catch(err => {
          this.logger.error(`Error publishing deal_stage_updated event to AG-UI: ${err.message}`, err.stack);
          // Non-critical error, so don't rethrow to client
        });
      } else {
        this.logger.warn(`Could not determine businessTenantId for AG-UI event publishing. Event not sent for deal ${updatedDeal.id}`);
      }

      return updatedDeal;
    } catch (error) {
      this.logger.error(`Error updating deal's Kanban column for deal ${dealRecordId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to update deal's Kanban column: ${error.message}`);
    }
  }

  // Optional CRUD for Kanban Columns
  async createKanbanColumn(dto: CreateKanbanColumnDto, createdByUserId?: string): Promise<KanbanColumn> {
    const db = this.ensureDbConnection();
    const newColumnData: Partial<KanbanColumn> = {
      name: dto.name,
      order: dto.order,
      board_type: 'deals', // Defaulting to 'deals' board type
      created_at: new Date().toISOString(),
    };
    // created_by_user_id could be added if schema supports it
    // if (createdByUserId) newColumnData.created_by_user_id = createdByUserId;

    this.logger.log(`Attempting to create Kanban column with data: ${JSON.stringify(newColumnData)}`);
    try {
      const createdRecords = await db.create<KanbanColumn>('kanban_columns', newColumnData);
      const createdColumn = Array.isArray(createdRecords) ? createdRecords[0] : createdRecords;
      this.logger.log(`Kanban column created successfully with ID: ${createdColumn.id}`);
      return createdColumn;
    } catch (error) {
      this.logger.error(`Error creating Kanban column: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create Kanban column: ${error.message}`);
    }
  }

  async getKanbanColumns(): Promise<KanbanColumn[]> {
    const db = this.ensureDbConnection();
    this.logger.log('Fetching all Kanban columns for the tenant.');
    try {
      const query = `SELECT * FROM kanban_columns ORDER BY \`order\` ASC;`;
      const result = await db.query<[KanbanColumn[]]>(query);
      const columns = result[0]?.result || [];
      this.logger.log(`Found ${columns.length} Kanban columns.`);
      return columns;
    } catch (error) {
      this.logger.error(`Error fetching Kanban columns: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch Kanban columns: ${error.message}`);
    }
  }

  async getKanbanColumn(id: string): Promise<KanbanColumn> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `kanban_columns:${id}`;
    this.logger.log(`Fetching Kanban column with ID: ${recordId}`);
    return await this.validateRecordExists(db, recordId, 'Kanban Column', 'kanban_columns') as KanbanColumn;
  }


  async updateKanbanColumn(id: string, dto: UpdateKanbanColumnDto): Promise<KanbanColumn> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `kanban_columns:${id}`;
    this.logger.log(`Attempting to update Kanban column ${recordId} with data: ${JSON.stringify(dto)}`);

    await this.validateRecordExists(db, recordId, 'Kanban Column', 'kanban_columns'); // Ensure it exists

    try {
      const updatedRecords = await db.merge<KanbanColumn>(recordId, dto);
      const updatedColumn = Array.isArray(updatedRecords) ? updatedRecords[0] : updatedRecords;
       if (!updatedColumn || !updatedColumn.id) {
         this.logger.warn(`Kanban column with ID ${recordId} not found after update attempt.`);
         throw new NotFoundException(`Kanban column with ID ${recordId} not found or update failed.`);
      }
      this.logger.log(`Kanban column ${recordId} updated successfully.`);
      return updatedColumn;
    } catch (error) {
      this.logger.error(`Error updating Kanban column ${recordId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to update Kanban column: ${error.message}`);
    }
  }

  async deleteKanbanColumn(id: string): Promise<void> {
    const db = this.ensureDbConnection();
    const recordId = id.includes(':') ? id : `kanban_columns:${id}`;
    this.logger.log(`Attempting to delete Kanban column: ${recordId}`);

    await this.validateRecordExists(db, recordId, 'Kanban Column', 'kanban_columns');

    // Check if any deals are associated with this column
    const dealsInColumnQuery = `SELECT count() FROM deals WHERE kanban_column_id = $columnId GROUP ALL;`;
    const dealsCountResult = await db.query<[[{ count: number }]]>(dealsInColumnQuery, { columnId: recordId });
    if (dealsCountResult[0]?.result[0]?.count > 0) {
      throw new BadRequestException(`Cannot delete column ${recordId} as it has ${dealsCountResult[0].result[0].count} associated deals. Please move them first.`);
    }

    try {
      await db.delete(recordId);
      this.logger.log(`Kanban column ${recordId} deleted successfully.`);
    } catch (error) {
      this.logger.error(`Error deleting Kanban column ${recordId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to delete Kanban column: ${error.message}`);
    }
  }
}
