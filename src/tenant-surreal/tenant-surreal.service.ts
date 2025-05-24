import { Injectable, Inject } from '@nestjs/common';
import Surreal from 'surrealdb.js';
import { TENANT_SURREAL_CONNECTION } from './tenant-surreal.module';

@Injectable()
export class TenantSurrealService {
  // This service primarily serves as a placeholder or for future expansion.
  // The actual request-scoped SurrealDB instance is injected using the TENANT_SURREAL_CONNECTION token.
  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly db: Surreal | null,
  ) {}

  getDb(): Surreal | null {
    if (!this.db) {
      // This might happen if the tenant context was not resolved for the request.
      console.warn('Attempted to get DB from TenantSurrealService, but no tenant DB instance was available.');
      // Depending on application requirements, could throw an error or return null.
    }
    return this.db;
  }

  // Add any tenant-specific database helper methods here if needed in the future.
  // For example, methods to ensure certain tables exist, etc., though schema management
  // is largely handled during tenant creation.
}
