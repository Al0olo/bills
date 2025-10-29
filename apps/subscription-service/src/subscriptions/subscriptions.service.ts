import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentClientService } from '../payment-client/payment-client.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { DowngradeSubscriptionDto } from './dto/downgrade-subscription.dto';
import {
  SubscriptionResponseDto,
  UpgradeResponseDto,
  DowngradeResponseDto,
} from './dto/subscription-response.dto';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponse,
} from '../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentClient: PaymentClientService
  ) {}

  /**
   * Create a new subscription
   */
  async create(
    userId: string,
    createSubscriptionDto: CreateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    const { planId } = createSubscriptionDto;

    const result = await this.prisma.executeTransaction(async (tx) => {
      // Validate user
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Validate plan
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan || !plan.isActive) {
        throw new NotFoundException({
          message: 'Plan not found or inactive',
          code: 'PLAN_NOT_FOUND',
        });
      }

      // Check for existing active subscription
      const existingSubscription = await tx.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (existingSubscription) {
        throw new ConflictException({
          message: 'User already has an active subscription',
          code: 'ACTIVE_SUBSCRIPTION_EXISTS',
          details: {
            existingSubscriptionId: existingSubscription.id,
            currentPlan: existingSubscription.planId,
          },
        });
      }

      // Create subscription with PENDING status
      const subscription = await tx.subscription.create({
        data: {
          userId,
          planId,
          status: 'PENDING',
          startDate: new Date(),
        },
        include: {
          plan: true,
        },
      });

      // Create payment record
      const paymentGatewayId = `pay_${uuidv4()}`;
      await tx.paymentRecord.create({
        data: {
          subscriptionId: subscription.id,
          amount: plan.price,
          currency: 'USD',
          status: 'PENDING',
          paymentGatewayId,
        },
      });

      // Update subscription with payment gateway ID
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: { paymentGatewayId },
        include: {
          plan: true,
        },
      });

      this.logger.log(
        `Subscription created: ${subscription.id} for user: ${userId}`
      );

      return updatedSubscription;
    });

    // Note: After transaction, initiate payment asynchronously
    // This will be done after returning the response
    return this.mapToResponse(result);
  }

  /**
   * Initiate payment after subscription creation
   * This should be called after the transaction commits
   */
  async initiatePayment(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      this.logger.error(`Subscription not found: ${subscriptionId}`);
      return;
    }

    try {
      const idempotencyKey = `payment_${subscriptionId}_${Date.now()}`;

      await this.paymentClient.initiatePayment(
        {
          externalReference: subscriptionId,
          amount: parseFloat(subscription.plan.price.toString()),
          currency: 'USD',
          metadata: {
            userId: subscription.userId,
            planId: subscription.planId,
            planName: subscription.plan.name,
          },
        },
        idempotencyKey
      );

      this.logger.log(`Payment initiated for subscription: ${subscriptionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initiate payment for subscription ${subscriptionId}: ${error.message}`
      );
      // In production, you might want to implement retry logic or mark subscription as failed
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async findAll(
    userId: string,
    paginationDto: PaginationDto,
    status?: string
  ): Promise<PaginatedResponse<SubscriptionResponseDto>> {
    const { page = 1, limit = 20, order = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          plan: true,
          previousPlan: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: order,
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    const mappedSubscriptions = subscriptions.map((sub) =>
      this.mapToResponse(sub)
    );

    return createPaginatedResponse(mappedSubscriptions, total, page, limit);
  }

  /**
   * Get subscription by ID
   */
  async findOne(id: string, userId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        plan: true,
        previousPlan: true,
        paymentRecords: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException({
        message: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND',
      });
    }

    return this.mapToResponse(subscription);
  }

  /**
   * Upgrade subscription to a higher tier plan
   */
  async upgrade(
    id: string,
    userId: string,
    upgradeDto: UpgradeSubscriptionDto
  ): Promise<UpgradeResponseDto> {
    const { newPlanId } = upgradeDto;

    return await this.prisma.executeTransaction(async (tx) => {
      // Get current subscription with lock
      const subscription = await tx.subscription.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          plan: true,
        },
      });

      if (!subscription) {
        throw new NotFoundException({
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        });
      }

      if (subscription.status !== 'ACTIVE') {
        throw new UnprocessableEntityException({
          message: 'Cannot upgrade: subscription is not active',
          code: 'INVALID_SUBSCRIPTION_STATE',
          details: {
            currentStatus: subscription.status,
            requiredStatus: 'ACTIVE',
          },
        });
      }

      // Get new plan
      const newPlan = await tx.plan.findUnique({
        where: { id: newPlanId },
      });

      if (!newPlan || !newPlan.isActive) {
        throw new NotFoundException({
          message: 'New plan not found or inactive',
          code: 'PLAN_NOT_FOUND',
        });
      }

      // Validate upgrade (new plan must be more expensive)
      if (newPlan.price <= subscription.plan.price) {
        throw new UnprocessableEntityException({
          message: 'New plan must be higher tier than current plan',
          code: 'INVALID_UPGRADE',
          details: {
            currentPlanPrice: parseFloat(subscription.plan.price.toString()),
            newPlanPrice: parseFloat(newPlan.price.toString()),
          },
        });
      }

      // Calculate prorated amount
      const proratedAmount = this.calculateProration(
        subscription.plan.price,
        newPlan.price
      );

      // Update subscription
      const updatedSubscription = await tx.subscription.update({
        where: { id },
        data: {
          planId: newPlanId,
          previousPlanId: subscription.planId,
        },
        include: {
          plan: true,
          previousPlan: true,
        },
      });

      // Create payment record for prorated amount
      const paymentGatewayId = `pay_upgrade_${uuidv4()}`;
      await tx.paymentRecord.create({
        data: {
          subscriptionId: id,
          amount: proratedAmount,
          currency: 'USD',
          status: 'PENDING',
          paymentGatewayId,
        },
      });

      this.logger.log(`Subscription upgraded: ${id} to plan: ${newPlanId}`);

      const response = this.mapToResponse(updatedSubscription) as UpgradeResponseDto;
      response.proratedAmount = parseFloat(proratedAmount.toString());

      return response;
    });
  }

  /**
   * Downgrade subscription to a lower tier plan
   */
  async downgrade(
    id: string,
    userId: string,
    downgradeDto: DowngradeSubscriptionDto
  ): Promise<DowngradeResponseDto> {
    const { newPlanId } = downgradeDto;

    return await this.prisma.executeTransaction(async (tx) => {
      // Get current subscription
      const subscription = await tx.subscription.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          plan: true,
        },
      });

      if (!subscription) {
        throw new NotFoundException({
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        });
      }

      if (subscription.status !== 'ACTIVE') {
        throw new UnprocessableEntityException({
          message: 'Cannot downgrade: subscription is not active',
          code: 'INVALID_SUBSCRIPTION_STATE',
          details: {
            currentStatus: subscription.status,
            requiredStatus: 'ACTIVE',
          },
        });
      }

      // Get new plan
      const newPlan = await tx.plan.findUnique({
        where: { id: newPlanId },
      });

      if (!newPlan || !newPlan.isActive) {
        throw new NotFoundException({
          message: 'New plan not found or inactive',
          code: 'PLAN_NOT_FOUND',
        });
      }

      // Validate downgrade (new plan must be less expensive)
      if (newPlan.price >= subscription.plan.price) {
        throw new UnprocessableEntityException({
          message: 'New plan must be lower tier than current plan',
          code: 'INVALID_DOWNGRADE',
          details: {
            currentPlanPrice: parseFloat(subscription.plan.price.toString()),
            newPlanPrice: parseFloat(newPlan.price.toString()),
          },
        });
      }

      // Update subscription (downgrade takes effect at end of billing period)
      const effectiveDate = new Date();
      effectiveDate.setMonth(effectiveDate.getMonth() + 1);

      const updatedSubscription = await tx.subscription.update({
        where: { id },
        data: {
          planId: newPlanId,
          previousPlanId: subscription.planId,
        },
        include: {
          plan: true,
          previousPlan: true,
        },
      });

      this.logger.log(`Subscription downgraded: ${id} to plan: ${newPlanId}`);

      const response = this.mapToResponse(updatedSubscription) as DowngradeResponseDto;
      response.effectiveDate = effectiveDate;
      response.note = 'Downgrade will take effect at the end of current billing period';

      return response;
    });
  }

  /**
   * Cancel subscription
   */
  async cancel(id: string, userId: string): Promise<SubscriptionResponseDto> {
    return await this.prisma.executeTransaction(async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!subscription) {
        throw new NotFoundException({
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        });
      }

      if (subscription.status === 'CANCELLED') {
        throw new UnprocessableEntityException({
          message: 'Subscription is already cancelled',
          code: 'ALREADY_CANCELLED',
        });
      }

      // Update subscription status
      const updatedSubscription = await tx.subscription.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          endDate: new Date(),
        },
        include: {
          plan: true,
          previousPlan: true,
        },
      });

      this.logger.log(`Subscription cancelled: ${id}`);

      return this.mapToResponse(updatedSubscription);
    });
  }

  /**
   * Calculate prorated amount for upgrade
   */
  private calculateProration(
    currentPrice: any,
    newPrice: any
  ): number {
    // Simple proration: difference between plans
    // In production, you'd calculate based on remaining days in billing cycle
    const current = parseFloat(currentPrice.toString());
    const newP = parseFloat(newPrice.toString());
    return Math.max(0, newP - current);
  }

  /**
   * Map database model to response DTO
   */
  private mapToResponse(subscription: any): SubscriptionResponseDto {
    return {
      id: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      paymentGatewayId: subscription.paymentGatewayId,
      previousPlanId: subscription.previousPlanId,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      plan: subscription.plan
        ? {
            id: subscription.plan.id,
            name: subscription.plan.name,
            description: subscription.plan.description,
            price: parseFloat(subscription.plan.price.toString()),
            billingCycle: subscription.plan.billingCycle,
            features: subscription.plan.features,
            isActive: subscription.plan.isActive,
            createdAt: subscription.plan.createdAt,
            updatedAt: subscription.plan.updatedAt,
          }
        : ({} as any),
      previousPlan: subscription.previousPlan
        ? {
            id: subscription.previousPlan.id,
            name: subscription.previousPlan.name,
            description: subscription.previousPlan.description,
            price: parseFloat(subscription.previousPlan.price.toString()),
            billingCycle: subscription.previousPlan.billingCycle,
            features: subscription.previousPlan.features,
            isActive: subscription.previousPlan.isActive,
            createdAt: subscription.previousPlan.createdAt,
            updatedAt: subscription.previousPlan.updatedAt,
          }
        : null,
      paymentRecords: subscription.paymentRecords?.map((record: any) => ({
        id: record.id,
        amount: parseFloat(record.amount.toString()),
        currency: record.currency,
        status: record.status,
        paymentGatewayId: record.paymentGatewayId,
        failureReason: record.failureReason,
        createdAt: record.createdAt,
      })),
    };
  }
}

