import { IsNotEmpty, IsString, IsOptional, IsNumber, Matches, IsISO8601, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

const SURREALDB_RECORD_ID_REGEX = /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/;

export class CreateDealDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsNotEmpty()
  @IsString()
  @Matches(SURREALDB_RECORD_ID_REGEX, {
    message: 'contact_id must be a valid SurrealDB record ID (e.g., contacts:id)',
  })
  contact_id: string;

  @IsNotEmpty()
  @IsString()
  @Matches(SURREALDB_RECORD_ID_REGEX, {
    message: 'kanban_column_id must be a valid SurrealDB record ID (e.g., kanban_columns:id)',
  })
  kanban_column_id: string; // This was named stage_id in the original schema, but dto uses kanban_column_id

  @IsOptional()
  @IsString()
  @Matches(SURREALDB_RECORD_ID_REGEX, {
    message: 'assigned_to_user_id must be a valid SurrealDB record ID (e.g., users:id)',
  })
  assigned_to_user_id?: string;

  @IsOptional()
  @IsISO8601()
  expected_close_date?: string;

  // created_by_user_id will be added by the service
}

export class UpdateDealDto extends PartialType(CreateDealDto) {}

// Interface for the Deal entity (matches SurrealDB table structure)
export interface Deal {
  id: string; // SurrealDB record ID, e.g., deals:dealIdValue
  name: string;
  value?: number;
  currency?: string;
  contact_id: string; // Record link to contacts table
  kanban_column_id: string; // Record link to kanban_columns table (or sales_funnel_stages)
  assigned_to_user_id?: string; // Record link to users table
  created_by_user_id?: string; // Record link to users table
  expected_close_date?: string; // ISO datetime string
  status?: string; // e.g., "open", "won", "lost" - managed by Kanban logic potentially
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}
