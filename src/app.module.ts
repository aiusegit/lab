import { Module, MiddlewareConsumer, RequestMethod, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MasterSurrealModule } from './master-surreal/master-surreal.module';
import { TenantSurrealModule } from './tenant-surreal/tenant-surreal.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { TenantMiddleware } from './tenant-context/tenant.middleware';
import { TenantContextService } from './tenant-context/tenant-context.service'; // Ensure this is provided
// Assuming TenantsService is exported from TenantsModule and needed by TenantMiddleware
// Assuming MasterSurrealService is globally available or provided where needed by TenantsService

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available globally
      envFilePath: '.env', // Specify the .env file
    }),
    MasterSurrealModule,
    TenantSurrealModule, // Provides request-scoped tenant DB & TenantContextService
    TenantsModule,       // Manages tenants in master DB, provides TenantsService
    AuthModule,          // Handles authentication against tenant DB
  ],
  controllers: [AppController], // Example controller, can be removed if not needed
  providers: [
    AppService,
    // TenantContextService is provided by TenantSurrealModule and/or TenantsModule.
    // No need to re-provide if those modules are imported.
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        // Exclude tenant creation and master admin login routes from tenant context requirement
        { path: 'tenants', method: RequestMethod.POST }, 
        // Add other master-level routes here, e.g., /auth/master/login
      )
      // Apply to routes that require tenant context, like auth and future CRM routes
      .forRoutes('auth', 'crm'); // Adjust 'crm' to your actual CRM module path prefix
  }
}
