import { IsNotEmpty, IsString, Matches, IsOptional, IsNumber, MinLength } from 'class-validator';
import { Deal } from '../../deals/dto/deals.dto'; // Assuming Deal interface is exported

const SURREALDB_RECORD_ID_REGEX = /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/;

export class UpdateDealKanbanColumnDto {
  @IsNotEmpty()
  @IsString()
  @Matches(SURREALDB_RECORD_ID_REGEX, {
    message: 'kanban_column_id must be a valid SurrealDB record ID (e.g., kanban_columns:id)',
  })
  kanban_column_id: string;
}

export class CreateKanbanColumnDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  name: string;

  @IsNotEmpty()
  @IsNumber()
  order: number;
}

export class UpdateKanbanColumnDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

// Interface for the KanbanColumn entity (matches SurrealDB table structure)
export interface KanbanColumn {
  id: string; // SurrealDB record ID, e.g., kanban_columns:columnIdValue
  name: string;
  order: number;
  board_type?: string; // e.g. 'deals' or 'tasks', assuming 'deals' for now
  created_at: string; // ISO datetime string
}

// Interface for the response of getKanbanBoardData
export interface KanbanColumnWithDeals extends KanbanColumn {
  deals: Deal[];
}
