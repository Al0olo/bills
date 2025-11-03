import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@ApiTags('Plans')
@Controller('v1/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all plans',
    description: 'Returns list of all subscription plans',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({
    status: 200,
    description: 'Plans list retrieved',
    type: [PlanResponseDto],
  })
  async findAll(
    @Query('isActive') isActive?: string
  ): Promise<PlanResponseDto[]> {
    // Default to showing only active plans if not specified
    const filter =
      isActive !== undefined ? isActive === 'true' : true;
    return this.plansService.findAll(filter);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiResponse({
    status: 200,
    description: 'Plan retrieved',
    type: PlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found',
    type: ErrorResponseDto,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PlanResponseDto> {
    return this.plansService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  @ApiOperation({
    summary: 'Create a new plan (admin only)',
    description: 'Creates a new subscription plan',
  })
  @ApiResponse({
    status: 201,
    description: 'Plan successfully created',
    type: PlanResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Plan with this name already exists',
    type: ErrorResponseDto,
  })
  async create(@Body() createPlanDto: CreatePlanDto): Promise<PlanResponseDto> {
    return this.plansService.create(createPlanDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(IdempotencyInterceptor)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a plan (admin only)',
    description: 'Updates an existing subscription plan',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan successfully updated',
    type: PlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanDto: UpdatePlanDto
  ): Promise<PlanResponseDto> {
    return this.plansService.update(id, updatePlanDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(IdempotencyInterceptor)
  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a plan (admin only)',
    description: 'Soft deletes a plan by setting isActive to false',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan successfully deactivated',
    type: PlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found',
    type: ErrorResponseDto,
  })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<PlanResponseDto> {
    return this.plansService.deactivate(id);
  }
}

