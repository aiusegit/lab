import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import { TenantsService } from '../../tenants/tenants.service'; // To look up tenant details if needed

interface JwtPayload {
  sub: string; // Typically user ID from SurrealDB (e.g., users:uuid)
  email: string;
  // Tenant identifiers that could be in the token:
  tid?: string; // Business tenant_id (preferred for lookup)
  ns?: string;  // Namespace ID
  db?: string;  // Database Name
  // scope: string; // e.g., "crm_user_scope" - from SurrealDB signin
  // Standard JWT claims
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantContextService: TenantContextService,
    private readonly tenantsService: TenantsService, // Master DB service
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'), // Ensure JWT_SECRET is in .env
      // passReqToCallback: true, // If we need to access req object in validate
    });
    if (!configService.get<string>('JWT_SECRET')) {
      this.logger.error('JWT_SECRET is not defined in environment variables. JWT authentication will fail.');
      throw new Error('JWT_SECRET is not defined.');
    }
  }

  async validate(payload: JwtPayload): Promise<any> {
    this.logger.debug(`Validating JWT payload: ${JSON.stringify(payload)}`);

    if (!payload.sub || !payload.email) {
      this.logger.warn('JWT payload missing sub (user ID) or email.');
      throw new UnauthorizedException('Invalid token: Missing essential claims.');
    }

    let namespaceId = payload.ns;
    let dbName = payload.db;

    // If only tenant_id (tid) is in the token, we need to look up ns and db from master.
    if (payload.tid && (!namespaceId || !dbName)) {
      this.logger.log(`JWT contains 'tid': ${payload.tid}. Looking up tenant details.`);
      const tenantDetails = await this.tenantsService.findTenantDetails(payload.tid);
      if (!tenantDetails || !tenantDetails.namespace_id || !tenantDetails.db_name) {
        this.logger.warn(`Failed to find tenant details for tid: ${payload.tid} or details incomplete.`);
        throw new UnauthorizedException('Invalid tenant identifier in token.');
      }
      namespaceId = tenantDetails.namespace_id;
      dbName = tenantDetails.db_name;
      this.logger.log(`Found tenant details for tid ${payload.tid}: ns=${namespaceId}, db=${dbName}`);
    }

    if (!namespaceId || !dbName) {
      this.logger.warn('Tenant namespace or database name could not be determined from JWT.');
      throw new UnauthorizedException('Invalid token: Tenant information missing or could not be resolved.');
    }

    // Set the tenant context for the current request scope
    this.tenantContextService.setTenantDetails(namespaceId, dbName);
    this.logger.log(`Tenant context set for request: ns=${namespaceId}, db=${dbName}`);

    // The object returned here will be attached to `req.user`
    return {
      id: payload.sub, // User's SurrealDB record ID
      email: payload.email,
      tenant_id: payload.tid, // Business tenant_id, if present
      namespace_id: namespaceId, // Namespace of the tenant
      db_name: dbName,           // Database name of the tenant
      // scope: payload.scope, // if you need to pass the scope along
    };
  }
}
