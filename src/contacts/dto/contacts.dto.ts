import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

const SURREALDB_RECORD_ID_REGEX = /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/;

export class CreateContactDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  // Example: users:userIdValue or users:⟨uuid⟩
  @Matches(SURREALDB_RECORD_ID_REGEX, {
    message: 'assigned_to_user_id must be a valid SurrealDB record ID (e.g., table:id)',
  })
  assigned_to_user_id?: string; 

  // created_by_user_id will be added by the service from the authenticated user
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

// Interface for the Contact entity (matches SurrealDB table structure)
// This isn't a DTO but represents the shape of the data.
export interface Contact {
  id: string; // SurrealDB record ID, e.g., contacts:contactIdValue
  first_name: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
  assigned_to_user_id?: string; // Record link to users table
  created_by_user_id?: string; // Record link to users table
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}
