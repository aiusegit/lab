import { Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Surreal from 'surrealdb.js';
import { TenantContextService } from '../tenant-context/tenant-context.service';

export const TENANT_SURREAL_CONNECTION = 'TENANT_SURREAL_CONNECTION';

@Module({
  imports: [ConfigModule],
  providers: [
    TenantContextService, // Ensure TenantContextService is available
    {
      provide: TENANT_SURREAL_CONNECTION,
      scope: Scope.REQUEST,
      inject: [REQUEST, ConfigService, TenantContextService],
      useFactory: async (request, configService: ConfigService, tenantContextService: TenantContextService) => {
        const { namespaceId, dbName } = tenantContextService.getTenantDetails();

        if (!namespaceId || !dbName) {
          // This can happen for requests that don't have tenant context (e.g. master routes)
          // Or if middleware hasn't populated context yet.
          // Depending on strictness, could throw error or return a non-functional/default DB instance.
          // For now, let's log and return null, services using this will need to handle it.
          console.warn('Tenant namespaceId or dbName not found in context for request-scoped SurrealDB instance.');
          return null;
        }

        const db = new Surreal();
        const dbUrl = configService.get<string>('TENANT_SURREALDB_URL'); // A general URL for tenant DBs
        const rootUser = configService.get<string>('TENANT_SURREALDB_ROOT_USER'); // Root user for initial connection
        const rootPass = configService.get<string>('TENANT_SURREALDB_ROOT_PASS'); // Root pass for initial connection

        if (!dbUrl) {
          throw new Error('TENANT_SURREALDB_URL is not defined in environment variables');
        }
        
        try {
          await db.connect(dbUrl);
          // Sign in as a root/admin user that has permissions to USE NS/DB
          // This user should be configured in SurrealDB with appropriate permissions.
          if (rootUser && rootPass) {
            await db.signin({ user: rootUser, pass: rootPass });
          } else {
            console.warn('TENANT_SURREALDB_ROOT_USER or TENANT_SURREALDB_ROOT_PASS not defined. May fail if DB requires auth for NS/DB operations.');
          }
          
          await db.use({ ns: namespaceId, db: dbName });
          console.log(`TenantSurrealService connected to ns: ${namespaceId}, db: ${dbName} for request`);
          
          // We don't sign out here, the connection is request-scoped and will be closed/discarded.
          // The actual user authentication for tenant operations will happen in AuthService using db.signin with tenant scope.

          return db;
        } catch (error) {
          console.error(`Failed to connect to Tenant SurrealDB (ns: ${namespaceId}, db: ${dbName}):`, error);
          throw error;
        }
      },
    },
  ],
  exports: [TENANT_SURREAL_CONNECTION, TenantContextService],
})
export class TenantSurrealModule {}
