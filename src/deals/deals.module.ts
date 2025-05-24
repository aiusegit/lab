import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { TenantSurrealModule } from '../tenant-surreal/tenant-surreal.module'; // Provides tenant-scoped DB & TenantContextService

@Module({
  imports: [
    TenantSurrealModule, // This provides the TENANT_SURREAL_CONNECTION and TenantContextService
  ],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService], // Export if other modules need to use DealsService
})
export class DealsModule {}
