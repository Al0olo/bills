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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { DowngradeSubscriptionDto } from './dto/downgrade-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import {
  SubscriptionResponseDto,
  UpgradeResponseDto,
  DowngradeResponseDto,
} from './dto/subscription-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Create a new subscription',
    description: 'Subscribe to a plan. Payment will be initiated automatically.',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User already has active subscription',
    type: ErrorResponseDto,
  })
  async create(
    @CurrentUser() user: any,
    @Body() createSubscriptionDto: CreateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsService.create(
      user.id,
      createSubscriptionDto
    );

    // Initiate payment asynchronously (fire and forget)
    this.subscriptionsService.initiatePayment(subscription.id).catch((error) => {
      // Log error but don't fail the request
      console.error('Failed to initiate payment:', error);
    });

    return subscription;
  }

  @Get()
  @ApiOperation({
    summary: 'Get user subscriptions',
    description: 'Returns paginated list of subscriptions for authenticated user',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED'],
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions list retrieved',
  })
  async findAll(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string
  ): Promise<PaginatedResponse<SubscriptionResponseDto>> {
    return this.subscriptionsService.findAll(user.id, paginationDto, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription details retrieved',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found',
    type: ErrorResponseDto,
  })
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.findOne(id, user.id);
  }

  @Patch(':id/upgrade')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Upgrade subscription',
    description:
      'Upgrade to a higher tier plan. Prorated amount will be charged.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription upgraded successfully',
    type: UpgradeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription or plan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Cannot upgrade (invalid state or plan)',
    type: ErrorResponseDto,
  })
  async upgrade(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() upgradeDto: UpgradeSubscriptionDto
  ): Promise<UpgradeResponseDto> {
    return this.subscriptionsService.upgrade(id, user.id, upgradeDto);
  }

  @Patch(':id/downgrade')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Downgrade subscription',
    description:
      'Downgrade to a lower tier plan. Takes effect at end of billing period.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription downgraded successfully',
    type: DowngradeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription or plan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Cannot downgrade (invalid state or plan)',
    type: ErrorResponseDto,
  })
  async downgrade(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() downgradeDto: DowngradeSubscriptionDto
  ): Promise<DowngradeResponseDto> {
    return this.subscriptionsService.downgrade(id, user.id, downgradeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel an active subscription immediately',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Cannot cancel (already cancelled)',
    type: ErrorResponseDto,
  })
  async cancel(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() cancelDto: CancelSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.cancel(id, user.id);
  }
}

