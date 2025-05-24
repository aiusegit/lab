import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { TenantSurrealModule } from '../tenant-surreal/tenant-surreal.module'; // Provides tenant-scoped DB & TenantContextService
// AuthModule might be needed if JwtAuthGuard is not global or if specific auth services are injected
// For now, assuming JwtAuthGuard is globally available or provided by a global AuthModule.
// If TenantContextService is not globally available via TenantSurrealModule, it might need to be imported/provided.

@Module({
  imports: [
    TenantSurrealModule, // This provides the TENANT_SURREAL_CONNECTION and TenantContextService
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService], // Export if other modules need to use ContactsService
})
export class ContactsModule {}
