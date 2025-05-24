import { Injectable, NestMiddleware, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { TenantsService } from '../tenants/tenants.service'; // Assuming TenantsService is in this path

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantsService: TenantsService, // Service to fetch tenant details from master DB
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    // Allow requests without x-tenant-id for certain paths (e.g., creating a new tenant, master admin login)
    // These paths should be explicitly excluded or handled differently.
    // For example, /tenants (POST) should not require this middleware or should bypass its logic.
    // Or, /auth/master/login for a super admin.
    // For now, if no tenantId is provided, we proceed without setting tenant context.
    // Services that require tenant context MUST check if it's available.
    if (!tenantId) {
      console.warn('TenantMiddleware: No x-tenant-id header found. Proceeding without tenant context.');
      return next();
    }

    try {
      console.log(`TenantMiddleware: Received x-tenant-id: ${tenantId}`);
      const tenantDetails = await this.tenantsService.findTenantDetails(tenantId);

      if (!tenantDetails) {
        console.warn(`TenantMiddleware: Tenant with ID ${tenantId} not found.`);
        // Option 1: Proceed without context (services must handle this)
        // Option 2: Throw an error (blocks requests for invalid tenants) - choosing this for now
        throw new NotFoundException(`Tenant with ID ${tenantId} not found.`);
      }

      if (!tenantDetails.namespace_id || !tenantDetails.db_name) {
        console.error(`TenantMiddleware: Incomplete tenant details for ${tenantId}. Namespace or DB name missing.`);
        throw new Error(`Incomplete configuration for tenant ${tenantId}.`);
      }
      
      console.log(`TenantMiddleware: Setting tenant context: ns=${tenantDetails.namespace_id}, db=${tenantDetails.db_name}`);
      this.tenantContextService.setTenantDetails(tenantDetails.namespace_id, tenantDetails.db_name);
      next();
    } catch (error) {
      console.error(`TenantMiddleware: Error processing tenant ID ${tenantId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      // For other errors, you might want a more generic error response
      throw new UnauthorizedException('Invalid or unprocessable tenant identifier.');
    }
  }
}
