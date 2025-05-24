import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ValidationPipe, Logger, Req } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming this path is correct
// import { User } from '../decorators/user.decorator'; // Example of a custom decorator to extract user from request

interface AuthenticatedRequest extends Request {
  user?: {
    id: string; // This should be the SurrealDB record ID of the user, e.g., 'users:xxxx'
    email: string;
    // other properties from JWT payload
  };
}

@UseGuards(JwtAuthGuard) // Apply to all routes in this controller
@Controller('contacts')
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  async create(
    @Body(new ValidationPipe()) createContactDto: CreateContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to create contact with data: ${JSON.stringify(createContactDto)}`);
    // Assuming req.user.id is the SurrealDB record ID of the authenticated user
    const createdByUserId = req.user?.id; 
    if (!createdByUserId) {
        this.logger.warn('User ID not found in request for creating contact. This should not happen if JwtAuthGuard is effective.');
        // Depending on strictness, could throw UnauthorizedException
    }
    return this.contactsService.create(createContactDto, createdByUserId);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} fetching all contacts.`);
    return this.contactsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    // Ensure id is just the UUID part if that's what's expected by the service
    // Or let the service handle `contacts:id` or just `id`
    this.logger.log(`User ${req.user?.id} fetching contact with ID: ${id}`);
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateContactDto: UpdateContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to update contact ${id} with data: ${JSON.stringify(updateContactDto)}`);
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} attempting to delete contact ${id}`);
    return this.contactsService.remove(id);
  }
}
