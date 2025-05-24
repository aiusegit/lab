import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
// import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'; // Example of using JwtAuthGuard
// import { TenantData } from './decorators/tenant-data.decorator'; // Example of a decorator to get tenant data

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Example of a tenant-aware route
  // @UseGuards(JwtAuthGuard) // This would ensure JWT is valid and TenantContext is populated
  // @Get('tenant-info')
  // getTenantInfo(@TenantData('namespace_id') namespaceId: string) {
  //   return `This request is for tenant namespace: ${namespaceId}`;
  // }
}
