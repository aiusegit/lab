import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { MasterSurrealModule } from '../master-surreal/master-surreal.module';
import { TenantMiddleware } from '../tenant-context/tenant.middleware';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule

@Module({
  imports: [
    MasterSurrealModule, // Provides MasterSurrealService
    ConfigModule, // Make ConfigService available
  ],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    TenantContextService, // TenantContextService needs to be available for TenantMiddleware
  ],
  exports: [TenantsService, TenantContextService], // Export TenantContextService if other modules need it directly
})
export class TenantsModule {
  configure(consumer: MiddlewareConsumer) {
    // The TenantMiddleware should NOT be applied to the TenantsController itself,
    // as tenant creation happens before a tenant context exists.
    // It should be applied to routes that operate *within* a tenant context.
    // Example:
    // consumer
    //   .apply(TenantMiddleware)
    //   .exclude(
    //     { path: 'tenants', method: RequestMethod.POST }, // Exclude tenant creation
    //     // Potentially exclude master admin login routes etc.
    //   )
    //   .forRoutes('*'); // Apply to all other routes or specific controllers
  }
}
