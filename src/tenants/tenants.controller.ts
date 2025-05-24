import { Controller, Post, Body, UseGuards, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, TenantResponseDto } from './entities/tenant.entity';
// import { MasterApiKeyGuard } from '../auth/guards/master-api-key.guard'; // Example guard

// TODO: Implement a proper MasterApiKeyGuard or SuperAdminGuard for this endpoint
// For now, it's unprotected for easier initial testing.
// @UseGuards(MasterApiKeyGuard) 
@Controller('tenants')
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    this.logger.log(`Received request to create tenant: ${JSON.stringify(createTenantDto.tenant_id)}`);
    try {
      const tenant = await this.tenantsService.createTenant(createTenantDto);
      this.logger.log(`Tenant created successfully: ${tenant.tenant_id}`);
      return tenant;
    } catch (error) {
      this.logger.error(`Error in TenantsController during tenant creation for ${createTenantDto.tenant_id}: ${error.message}`, error.stack);
      // Error is already wrapped by service, but can re-wrap or handle specific controller errors here
      throw error; 
    }
  }
}
