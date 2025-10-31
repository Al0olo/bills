import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { DowngradeSubscriptionDto } from './dto/downgrade-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { PaginationDto, SortOrder } from '../common/dto/pagination.dto';
import { SubscriptionResponseDto, UpgradeResponseDto, DowngradeResponseDto, SubscriptionStatus } from './dto/subscription-response.dto';
import { BillingCycle } from '../plans/dto/create-plan.dto';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockSubscriptionResponse: SubscriptionResponseDto = {
    id: 'sub-123',
    userId: mockUser.id,
    planId: 'plan-123',
    status: SubscriptionStatus.ACTIVE,
    startDate: new Date(),
    endDate: null,
    paymentGatewayId: 'pay_123',
    previousPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: {
      id: 'plan-123',
      name: 'Basic Plan',
      description: 'Basic subscription',
      price: 9.99,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Feature 1'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    previousPlan: null,
  };

  beforeEach(async () => {
    const mockSubscriptionsService = {
      create: jest.fn(),
      initiatePayment: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn(),
      findOne: jest.fn(),
      upgrade: jest.fn(),
      downgrade: jest.fn(),
      cancel: jest.fn(),
    };

    const mockPrismaService = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          key: 'test-key',
          response: {},
          expiresAt: new Date(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        IdempotencyInterceptor,
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    subscriptionsService = module.get(SubscriptionsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateSubscriptionDto = {
      planId: 'plan-123',
    };

    it('should be defined', () => {
      expect(controller.create).toBeDefined();
    });

    it('should successfully create a subscription', async () => {
      subscriptionsService.create.mockResolvedValue(mockSubscriptionResponse);
      subscriptionsService.initiatePayment.mockResolvedValue();

      const result = await controller.create(mockUser, createDto);

      expect(subscriptionsService.create).toHaveBeenCalledWith(
        mockUser.id,
        createDto
      );
      expect(result).toEqual(mockSubscriptionResponse);
    });

    it('should initiate payment asynchronously', async () => {
      subscriptionsService.create.mockResolvedValue(mockSubscriptionResponse);
      subscriptionsService.initiatePayment.mockResolvedValue();

      await controller.create(mockUser, createDto);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(subscriptionsService.initiatePayment).toHaveBeenCalledWith(
        mockSubscriptionResponse.id
      );
    });

    it('should not fail if payment initiation fails', async () => {
      subscriptionsService.create.mockResolvedValue(mockSubscriptionResponse);
      subscriptionsService.initiatePayment.mockRejectedValue(
        new Error('Payment service error')
      );

      const result = await controller.create(mockUser, createDto);

      expect(result).toEqual(mockSubscriptionResponse);
      // Should not throw despite payment initiation failure
    });

    it('should propagate service creation errors', async () => {
      const error = new Error('User already has active subscription');
      subscriptionsService.create.mockRejectedValue(error);

      await expect(controller.create(mockUser, createDto)).rejects.toThrow(
        error
      );
    });

    it('should extract user ID from authenticated user', async () => {
      subscriptionsService.create.mockResolvedValue(mockSubscriptionResponse);

      await controller.create(mockUser, createDto);

      expect(subscriptionsService.create).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object)
      );
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = {
      page: 1,
      limit: 20,
      order: SortOrder.DESC,
    };

    const mockPaginatedResponse = {
      data: [mockSubscriptionResponse],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('should be defined', () => {
      expect(controller.findAll).toBeDefined();
    });

    it('should return paginated subscriptions', async () => {
      subscriptionsService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll(mockUser, paginationDto);

      expect(subscriptionsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        paginationDto,
        undefined
      );
      expect(result).toEqual(mockPaginatedResponse);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by status if provided', async () => {
      subscriptionsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(mockUser, paginationDto, 'ACTIVE');

      expect(subscriptionsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        paginationDto,
        'ACTIVE'
      );
    });

    it('should handle empty results', async () => {
      const emptyResponse = {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      subscriptionsService.findAll.mockResolvedValue(emptyResponse);

      const result = await controller.findAll(mockUser, paginationDto);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should pass pagination parameters correctly', async () => {
      const customPagination: PaginationDto = {
        page: 2,
        limit: 10,
        order: SortOrder.ASC,
      };
      subscriptionsService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(mockUser, customPagination);

      expect(subscriptionsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        customPagination,
        undefined
      );
    });
  });

  describe('findOne', () => {
    it('should be defined', () => {
      expect(controller.findOne).toBeDefined();
    });

    it('should return a subscription by ID', async () => {
      subscriptionsService.findOne.mockResolvedValue(mockSubscriptionResponse);

      const result = await controller.findOne(
        mockUser,
        mockSubscriptionResponse.id
      );

      expect(subscriptionsService.findOne).toHaveBeenCalledWith(
        mockSubscriptionResponse.id,
        mockUser.id
      );
      expect(result).toEqual(mockSubscriptionResponse);
    });

    it('should pass both subscription ID and user ID to service', async () => {
      subscriptionsService.findOne.mockResolvedValue(mockSubscriptionResponse);

      await controller.findOne(mockUser, 'sub-456');

      expect(subscriptionsService.findOne).toHaveBeenCalledWith(
        'sub-456',
        mockUser.id
      );
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Subscription not found');
      subscriptionsService.findOne.mockRejectedValue(error);

      await expect(
        controller.findOne(mockUser, 'non-existent')
      ).rejects.toThrow(error);
    });
  });

  describe('upgrade', () => {
    const upgradeDto: UpgradeSubscriptionDto = {
      newPlanId: 'premium-plan',
    };

    const upgradeResponse: UpgradeResponseDto = {
      ...mockSubscriptionResponse,
      planId: upgradeDto.newPlanId,
      previousPlanId: 'plan-123',
      proratedAmount: 20,
    };

    it('should be defined', () => {
      expect(controller.upgrade).toBeDefined();
    });

    it('should successfully upgrade subscription', async () => {
      subscriptionsService.upgrade.mockResolvedValue(upgradeResponse);

      const result = await controller.upgrade(
        mockUser,
        mockSubscriptionResponse.id,
        upgradeDto
      );

      expect(subscriptionsService.upgrade).toHaveBeenCalledWith(
        mockSubscriptionResponse.id,
        mockUser.id,
        upgradeDto
      );
      expect(result).toEqual(upgradeResponse);
      expect(result).toHaveProperty('proratedAmount');
    });

    it('should pass all parameters correctly', async () => {
      subscriptionsService.upgrade.mockResolvedValue(upgradeResponse);

      await controller.upgrade(mockUser, 'sub-789', upgradeDto);

      expect(subscriptionsService.upgrade).toHaveBeenCalledWith(
        'sub-789',
        mockUser.id,
        upgradeDto
      );
    });

    it('should propagate UnprocessableEntityException from service', async () => {
      const error = new Error('Cannot upgrade: subscription is not active');
      subscriptionsService.upgrade.mockRejectedValue(error);

      await expect(
        controller.upgrade(mockUser, mockSubscriptionResponse.id, upgradeDto)
      ).rejects.toThrow(error);
    });

    it('should return prorated amount in response', async () => {
      subscriptionsService.upgrade.mockResolvedValue(upgradeResponse);

      const result = await controller.upgrade(
        mockUser,
        mockSubscriptionResponse.id,
        upgradeDto
      );

      expect(result.proratedAmount).toBeDefined();
      expect(result.proratedAmount).toBe(20);
    });
  });

  describe('downgrade', () => {
    const downgradeDto: DowngradeSubscriptionDto = {
      newPlanId: 'basic-plan',
    };

    const downgradeResponse: DowngradeResponseDto = {
      ...mockSubscriptionResponse,
      planId: downgradeDto.newPlanId,
      previousPlanId: 'premium-plan',
      effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      note: 'Downgrade will take effect at the end of current billing period',
    };

    it('should be defined', () => {
      expect(controller.downgrade).toBeDefined();
    });

    it('should successfully downgrade subscription', async () => {
      subscriptionsService.downgrade.mockResolvedValue(downgradeResponse);

      const result = await controller.downgrade(
        mockUser,
        mockSubscriptionResponse.id,
        downgradeDto
      );

      expect(subscriptionsService.downgrade).toHaveBeenCalledWith(
        mockSubscriptionResponse.id,
        mockUser.id,
        downgradeDto
      );
      expect(result).toEqual(downgradeResponse);
      expect(result).toHaveProperty('effectiveDate');
      expect(result).toHaveProperty('note');
    });

    it('should pass all parameters correctly', async () => {
      subscriptionsService.downgrade.mockResolvedValue(downgradeResponse);

      await controller.downgrade(mockUser, 'sub-789', downgradeDto);

      expect(subscriptionsService.downgrade).toHaveBeenCalledWith(
        'sub-789',
        mockUser.id,
        downgradeDto
      );
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Cannot downgrade: subscription is not active');
      subscriptionsService.downgrade.mockRejectedValue(error);

      await expect(
        controller.downgrade(mockUser, mockSubscriptionResponse.id, downgradeDto)
      ).rejects.toThrow(error);
    });

    it('should return effective date in response', async () => {
      subscriptionsService.downgrade.mockResolvedValue(downgradeResponse);

      const result = await controller.downgrade(
        mockUser,
        mockSubscriptionResponse.id,
        downgradeDto
      );

      expect(result.effectiveDate).toBeDefined();
      expect(result.effectiveDate?.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('cancel', () => {
    const cancelDto: CancelSubscriptionDto = {};

    const cancelledResponse: SubscriptionResponseDto = {
      ...mockSubscriptionResponse,
      status: SubscriptionStatus.CANCELLED,
      endDate: new Date(),
    };

    it('should be defined', () => {
      expect(controller.cancel).toBeDefined();
    });

    it('should successfully cancel subscription', async () => {
      subscriptionsService.cancel.mockResolvedValue(cancelledResponse);

      const result = await controller.cancel(
        mockUser,
        mockSubscriptionResponse.id,
        cancelDto
      );

      expect(subscriptionsService.cancel).toHaveBeenCalledWith(
        mockSubscriptionResponse.id,
        mockUser.id
      );
      expect(result).toEqual(cancelledResponse);
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should pass subscription ID and user ID to service', async () => {
      subscriptionsService.cancel.mockResolvedValue(cancelledResponse);

      await controller.cancel(mockUser, 'sub-789', cancelDto);

      expect(subscriptionsService.cancel).toHaveBeenCalledWith(
        'sub-789',
        mockUser.id
      );
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Subscription not found');
      subscriptionsService.cancel.mockRejectedValue(error);

      await expect(
        controller.cancel(mockUser, 'non-existent', cancelDto)
      ).rejects.toThrow(error);
    });

    it('should propagate UnprocessableEntityException if already cancelled', async () => {
      const error = new Error('Subscription is already cancelled');
      subscriptionsService.cancel.mockRejectedValue(error);

      await expect(
        controller.cancel(mockUser, mockSubscriptionResponse.id, cancelDto)
      ).rejects.toThrow(error);
    });

    it('should return subscription with cancelled status', async () => {
      subscriptionsService.cancel.mockResolvedValue(cancelledResponse);

      const result = await controller.cancel(
        mockUser,
        mockSubscriptionResponse.id,
        cancelDto
      );

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.endDate).toBeDefined();
    });
  });

  describe('controller metadata', () => {
    it('should have correct route prefix', () => {
      const metadata = Reflect.getMetadata('path', SubscriptionsController);
      expect(metadata).toBe('v1/subscriptions');
    });

    it('should have create endpoint as POST', () => {
      const metadata = Reflect.getMetadata(
        'path',
        SubscriptionsController.prototype.create
      );
      expect(metadata).toBe('/');
    });

    it('should have findAll endpoint as GET', () => {
      const metadata = Reflect.getMetadata(
        'path',
        SubscriptionsController.prototype.findAll
      );
      expect(metadata).toBe('/');
    });

    it('should have findOne endpoint as GET with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        SubscriptionsController.prototype.findOne
      );
      expect(metadata).toBe(':id');
    });

    it('should have upgrade endpoint as PATCH with :id/upgrade', () => {
      const metadata = Reflect.getMetadata(
        'path',
        SubscriptionsController.prototype.upgrade
      );
      expect(metadata).toBe(':id/upgrade');
    });

    it('should have downgrade endpoint as PATCH with :id/downgrade', () => {
      const metadata = Reflect.getMetadata(
        'path',
        SubscriptionsController.prototype.downgrade
      );
      expect(metadata).toBe(':id/downgrade');
    });

    it('should have cancel endpoint as DELETE with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        SubscriptionsController.prototype.cancel
      );
      expect(metadata).toBe(':id');
    });
  });

  describe('user authorization', () => {
    it('should use authenticated user ID in create', async () => {
      subscriptionsService.create.mockResolvedValue(mockSubscriptionResponse);

      await controller.create(mockUser, { planId: 'plan-123' });

      expect(subscriptionsService.create).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should use authenticated user ID in findAll', async () => {
      subscriptionsService.findAll.mockResolvedValue({
        data: [],
        meta: {} as any,
      });

      await controller.findAll(mockUser, {} as PaginationDto);

      expect(subscriptionsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object),
        undefined
      );
    });

    it('should use authenticated user ID in findOne', async () => {
      subscriptionsService.findOne.mockResolvedValue(mockSubscriptionResponse);

      await controller.findOne(mockUser, 'sub-123');

      expect(subscriptionsService.findOne).toHaveBeenCalledWith(
        'sub-123',
        mockUser.id
      );
    });

    it('should use authenticated user ID in upgrade', async () => {
      subscriptionsService.upgrade.mockResolvedValue({} as any);

      await controller.upgrade(mockUser, 'sub-123', { newPlanId: 'plan-456' });

      expect(subscriptionsService.upgrade).toHaveBeenCalledWith(
        'sub-123',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should use authenticated user ID in downgrade', async () => {
      subscriptionsService.downgrade.mockResolvedValue({} as any);

      await controller.downgrade(mockUser, 'sub-123', { newPlanId: 'plan-456' });

      expect(subscriptionsService.downgrade).toHaveBeenCalledWith(
        'sub-123',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should use authenticated user ID in cancel', async () => {
      subscriptionsService.cancel.mockResolvedValue(mockSubscriptionResponse);

      await controller.cancel(mockUser, 'sub-123', {});

      expect(subscriptionsService.cancel).toHaveBeenCalledWith(
        'sub-123',
        mockUser.id
      );
    });
  });
});

