import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantSurrealModule } from '../tenant-surreal/tenant-surreal.module'; // Provides tenant-scoped DB connection
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantsModule } from '../tenants/tenants.module'; // Provides TenantsService for JWT strategy

@Global() // Making AuthModule global to make JwtAuthGuard easily usable across modules
@Module({
  imports: [
    ConfigModule, // Ensure ConfigService is available
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1h', // Example: '60s', '1h', '7d'
        },
      }),
    }),
    TenantSurrealModule, // Provides TENANT_SURREAL_CONNECTION and TenantContextService
    TenantsModule, // Exports TenantsService, which is used by JwtStrategy to look up tenant details
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // TenantContextService is already provided and exported by TenantSurrealModule if it's there,
    // or by TenantsModule. Ensure it's available for JwtStrategy.
    // If TenantContextService is defined in its own module, that module should be imported.
    // For now, assuming TenantContextService is provided by TenantsModule or TenantSurrealModule.
  ],
  exports: [AuthService, JwtModule, PassportModule], // Export JwtModule and PassportModule if needed by other modules for guards
})
export class AuthModule {}
