import { Controller, Post, Body, Param, UseGuards, ValidationPipe, Logger, Req } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { SendMessageDto } from './dto/whatsapp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming this path is correct
// TenantContextService is not directly injected here; tenant_id is part of JWT or derived by JwtAuthGuard
// The WhatsAppService is request-scoped and will pick up the tenant context.

interface AuthenticatedRequest extends Request {
  user?: {
    id: string; // SurrealDB record ID of the user, e.g., 'users:xxxx'
    email: string;
    // tenant_id might be directly in the token, or ns/db from which tenant_id can be derived
    // For this example, let's assume tenant_id is available or TenantContextService is populated
    // by JwtStrategy and WhatsAppService (being request-scoped) can access it.
  };
}

@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('contacts/:contactId/send-message')
  async sendMessageToContact(
    @Param('contactId') contactId: string,
    @Body(new ValidationPipe()) sendMessageDto: SendMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // The tenantId is not explicitly passed from controller to service here.
    // Instead, WhatsAppService is request-scoped. When JwtAuthGuard runs,
    // JwtStrategy populates TenantContextService. Since WhatsAppService is
    // request-scoped and injects TenantContextService (and TENANT_SURREAL_CONNECTION
    // which also uses TenantContextService), it operates within the correct tenant context.
    this.logger.log(`User ${req.user?.id} attempting to send WhatsApp message to contact ${contactId}.`);
    
    // The `sendMessage` method in `WhatsAppService` will use its internally available
    // tenant-scoped DB connection and `TenantContextService` to determine the tenant.
    return this.whatsappService.sendMessage(contactId, sendMessageDto.messageText);
  }
}
