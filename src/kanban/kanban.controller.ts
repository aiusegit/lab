import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ValidationPipe, Logger, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { KanbanService } from './kanban.service';
import { UpdateDealKanbanColumnDto, CreateKanbanColumnDto, UpdateKanbanColumnDto } from './dto/kanban.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string; // SurrealDB record ID of the user, e.g., 'users:xxxx'
    email: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('kanban')
export class KanbanController {
  private readonly logger = new Logger(KanbanController.name);

  constructor(private readonly kanbanService: KanbanService) {}

  @Get('board')
  async getKanbanBoardData(@Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} fetching Kanban board data.`);
    return this.kanbanService.getKanbanBoardData();
  }

  // This endpoint is more RESTful if it's on the deal resource,
  // but placing it here for grouping Kanban-related actions.
  // Alternative: PATCH /deals/:dealId and the DTO specifies the kanban_column_id field
  @Patch('/deals/:dealId/column')
  async updateDealKanbanColumn(
    @Param('dealId') dealId: string,
    @Body(new ValidationPipe()) updateDto: UpdateDealKanbanColumnDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to update Kanban column for deal ${dealId} to ${updateDto.kanban_column_id}.`);
    return this.kanbanService.updateDealKanbanColumn(dealId, updateDto.kanban_column_id);
  }

  // --- Optional CRUD for Kanban Columns ---

  @Post('columns')
  @HttpCode(HttpStatus.CREATED)
  async createKanbanColumn(
    @Body(new ValidationPipe()) createDto: CreateKanbanColumnDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to create Kanban column with data: ${JSON.stringify(createDto)}.`);
    // const createdByUserId = req.user?.id; // If you want to track who created the column
    return this.kanbanService.createKanbanColumn(createDto /*, createdByUserId */);
  }

  @Get('columns')
  async getKanbanColumns(@Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} fetching all Kanban columns.`);
    return this.kanbanService.getKanbanColumns();
  }

  @Get('columns/:id')
  async getKanbanColumn(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} fetching Kanban column with ID: ${id}`);
    return this.kanbanService.getKanbanColumn(id);
  }

  @Patch('columns/:id')
  async updateKanbanColumn(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateDto: UpdateKanbanColumnDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`User ${req.user?.id} attempting to update Kanban column ${id} with data: ${JSON.stringify(updateDto)}.`);
    return this.kanbanService.updateKanbanColumn(id, updateDto);
  }

  @Delete('columns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKanbanColumn(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.logger.log(`User ${req.user?.id} attempting to delete Kanban column ${id}.`);
    return this.kanbanService.deleteKanbanColumn(id);
  }
}
