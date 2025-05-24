import { Module } from '@nestjs/common';
import { KanbanService } from './kanban.service';
import { KanbanController } from './kanban.controller';
import { TenantSurrealModule } from '../tenant-surreal/tenant-surreal.module'; // Provides tenant-scoped DB & TenantContextService
// DealsModule might be imported if there are direct service-to-service interactions,
// but for now, Deal DTO is just referenced by type.

@Module({
  imports: [
    TenantSurrealModule, // This provides the TENANT_SURREAL_CONNECTION and TenantContextService
  ],
  controllers: [KanbanController],
  providers: [KanbanService],
  exports: [KanbanService], // Export if other modules need to use KanbanService
})
export class KanbanModule {}
