import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { BaileysManagerService } from './baileys-manager.service';
import { TenantSurrealModule } from '../tenant-surreal/tenant-surreal.module';
import { ContactsModule } from '../contacts/contacts.module'; // To use ContactsService

// Making BaileysManagerService global so it's instantiated once and can be injected anywhere if needed,
// though primarily used by WhatsAppService.
@Global()
@Module({
  imports: [
    ConfigModule, // Make ConfigService available
    TenantSurrealModule, // Provides TENANT_SURREAL_CONNECTION and TenantContextService
    ContactsModule,      // Provides ContactsService
  ],
  controllers: [WhatsAppController],
  providers: [
    BaileysManagerService, // Singleton Baileys client manager
    WhatsAppService,       // Request-scoped service using BaileysManager
  ],
  exports: [WhatsAppService, BaileysManagerService], // Export if other modules need them
})
export class WhatsAppModule {}
