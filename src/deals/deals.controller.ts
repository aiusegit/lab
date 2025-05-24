import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ValidationPipe, Logger, Req } from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto, UpdateDealDto } from './dto/deals.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming this path is correct

interface AuthenticatedRequest extends Request {
  user?: {
    id: string; // SurrealDB record ID of the user, e.g., 'users:xxxx'
    email: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(private readonly dealsService: DealsService) {}

  @Post()
  async create(
    @Body(new ValidationPipe()) createDealDto: CreateDealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to create deal with data: ${JSON.stringify(createDealDto)}`);
    const createdByUserId = req.user?.id;
    if (!createdByUserId) {
        this.logger.warn('User ID not found in request for creating deal.');
    }
    return this.dealsService.create(createDealDto, createdByUserId);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} fetching all deals.`);
    return this.dealsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} fetching deal with ID: ${id}`);
    return this.dealsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateDealDto: UpdateDealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to update deal ${id} with data: ${JSON.stringify(updateDealDto)}`);
    return this.dealsService.update(id, updateDealDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} attempting to delete deal ${id}`);
    return this.dealsService.remove(id);
  }
}
