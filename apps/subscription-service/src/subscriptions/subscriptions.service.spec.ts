import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentClientService } from '../payment-client/payment-client.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { DowngradeSubscriptionDto } from './dto/downgrade-subscription.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prismaService: any;
  let paymentClient: jest.Mocked<PaymentClientService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockPlan = {
    id: 'plan-123',
    name: 'Basic Plan',
    description: 'Basic subscription',
    price: 9.99,
    billingCycle: 'MONTHLY',
    features: ['Feature 1'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPremiumPlan = {
    ...mockPlan,
    id: 'plan-premium',
    name: 'Premium Plan',
    price: 29.99,
  };

  const mockSubscription = {
    id: 'sub-123',
    userId: mockUser.id,
    planId: mockPlan.id,
    status: 'ACTIVE',
    startDate: new Date(),
    endDate: null,
    paymentGatewayId: 'pay_123',
    previousPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: mockPlan,
    previousPlan: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      executeTransaction: jest.fn((callback) => callback(mockPrismaService)),
      subscription: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      plan: {
        findUnique: jest.fn(),
      },
      paymentRecord: {
        create: jest.fn(),
      },
    };

    const mockPaymentClientService = {
      initiatePayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PaymentClientService,
          useValue: mockPaymentClientService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    prismaService = module.get(PrismaService);
    paymentClient = module.get(PaymentClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateSubscriptionDto = {
      planId: mockPlan.id,
    };

    it('should successfully create a new subscription', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.subscription.findFirst.mockResolvedValue(null);
      prismaService.subscription.create.mockResolvedValue({
        ...mockSubscription,
        status: 'PENDING',
      });
      prismaService.subscription.update.mockResolvedValue(mockSubscription);

      const result = await service.create(mockUser.id, createDto);

      expect(prismaService.executeTransaction).toHaveBeenCalled();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.planId },
      });
      expect(result).toHaveProperty('id');
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException if plan does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow('Plan not found or inactive');
    });

    it('should throw NotFoundException if plan is inactive', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.plan.findUnique.mockResolvedValue({
        ...mockPlan,
        isActive: false,
      });

      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user already has active subscription', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);

      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(mockUser.id, createDto)
      ).rejects.toThrow('User already has an active subscription');
    });

    it('should create payment record with correct amount', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.subscription.findFirst.mockResolvedValue(null);
      prismaService.subscription.create.mockResolvedValue({
        ...mockSubscription,
        status: 'PENDING',
      });
      prismaService.subscription.update.mockResolvedValue(mockSubscription);

      await service.create(mockUser.id, createDto);

      expect(prismaService.paymentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: mockPlan.price,
            currency: 'USD',
            status: 'PENDING',
          }),
        })
      );
    });

    it('should create subscription with PENDING status', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.subscription.findFirst.mockResolvedValue(null);
      prismaService.subscription.create.mockResolvedValue({
        ...mockSubscription,
        status: 'PENDING',
      });
      prismaService.subscription.update.mockResolvedValue(mockSubscription);

      await service.create(mockUser.id, createDto);

      expect(prismaService.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });
  });

  describe('initiatePayment', () => {
    it('should successfully initiate payment', async () => {
      prismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      paymentClient.initiatePayment.mockResolvedValue({} as any);

      await service.initiatePayment(mockSubscription.id);

      expect(prismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        include: { plan: true },
      });
      expect(paymentClient.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          externalReference: mockSubscription.id,
          amount: mockPlan.price,
          currency: 'USD',
        }),
        expect.any(String)
      );
    });

    it('should handle subscription not found gracefully', async () => {
      prismaService.subscription.findUnique.mockResolvedValue(null);

      await service.initiatePayment('non-existent');

      expect(paymentClient.initiatePayment).not.toHaveBeenCalled();
    });

    it('should handle payment client errors gracefully', async () => {
      prismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      paymentClient.initiatePayment.mockRejectedValue(
        new Error('Payment service error')
      );

      await expect(
        service.initiatePayment(mockSubscription.id)
      ).resolves.not.toThrow();
    });

    it('should include metadata in payment request', async () => {
      prismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      paymentClient.initiatePayment.mockResolvedValue({} as any);

      await service.initiatePayment(mockSubscription.id);

      expect(paymentClient.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: mockUser.id,
            planId: mockPlan.id,
            planName: mockPlan.name,
          }),
        }),
        expect.any(String)
      );
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = {
      page: 1,
      limit: 20,
      order: 'desc',
    };

    it('should return paginated subscriptions', async () => {
      const mockSubscriptions = [mockSubscription];
      prismaService.subscription.findMany.mockResolvedValue(mockSubscriptions);
      prismaService.subscription.count.mockResolvedValue(1);

      const result = await service.findAll(mockUser.id, paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by status if provided', async () => {
      prismaService.subscription.findMany.mockResolvedValue([]);
      prismaService.subscription.count.mockResolvedValue(0);

      await service.findAll(mockUser.id, paginationDto, 'ACTIVE');

      expect(prismaService.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, status: 'ACTIVE' },
        })
      );
    });

    it('should handle pagination correctly', async () => {
      const customPagination: PaginationDto = {
        page: 2,
        limit: 10,
        order: 'asc',
      };

      prismaService.subscription.findMany.mockResolvedValue([]);
      prismaService.subscription.count.mockResolvedValue(15);

      await service.findAll(mockUser.id, customPagination);

      expect(prismaService.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should return empty array if no subscriptions', async () => {
      prismaService.subscription.findMany.mockResolvedValue([]);
      prismaService.subscription.count.mockResolvedValue(0);

      const result = await service.findAll(mockUser.id, paginationDto);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should include plan details in response', async () => {
      prismaService.subscription.findMany.mockResolvedValue([mockSubscription]);
      prismaService.subscription.count.mockResolvedValue(1);

      const result = await service.findAll(mockUser.id, paginationDto);

      expect(result.data[0].plan).toBeDefined();
      expect(result.data[0].plan.name).toBe(mockPlan.name);
    });
  });

  describe('findOne', () => {
    it('should return a subscription by ID', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await service.findOne(mockSubscription.id, mockUser.id);

      expect(prismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: { id: mockSubscription.id, userId: mockUser.id },
        include: expect.objectContaining({
          plan: true,
          previousPlan: true,
          paymentRecords: expect.any(Object),
        }),
      });
      expect(result.id).toBe(mockSubscription.id);
    });

    it('should throw NotFoundException if subscription does not exist', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', mockUser.id)
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return subscription belonging to different user', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockSubscription.id, 'different-user')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upgrade', () => {
    const upgradeDto: UpgradeSubscriptionDto = {
      newPlanId: mockPremiumPlan.id,
    };

    it('should successfully upgrade subscription', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.plan.findUnique.mockResolvedValue(mockPremiumPlan);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        planId: mockPremiumPlan.id,
        previousPlanId: mockPlan.id,
        plan: mockPremiumPlan,
        previousPlan: mockPlan,
      });

      const result = await service.upgrade(
        mockSubscription.id,
        mockUser.id,
        upgradeDto
      );

      expect(result.planId).toBe(mockPremiumPlan.id);
      expect(result.previousPlanId).toBe(mockPlan.id);
      expect(result).toHaveProperty('proratedAmount');
    });

    it('should throw NotFoundException if subscription not found', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.upgrade(mockSubscription.id, mockUser.id, upgradeDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException if subscription not active', async () => {
      prismaService.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
      });

      await expect(
        service.upgrade(mockSubscription.id, mockUser.id, upgradeDto)
      ).rejects.toThrow(UnprocessableEntityException);
      await expect(
        service.upgrade(mockSubscription.id, mockUser.id, upgradeDto)
      ).rejects.toThrow('Cannot upgrade: subscription is not active');
    });

    it('should throw UnprocessableEntityException if new plan is not higher tier', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.plan.findUnique.mockResolvedValue({
        ...mockPlan,
        price: 5.99, // Lower price
      });

      await expect(
        service.upgrade(mockSubscription.id, mockUser.id, upgradeDto)
      ).rejects.toThrow(UnprocessableEntityException);
      await expect(
        service.upgrade(mockSubscription.id, mockUser.id, upgradeDto)
      ).rejects.toThrow('New plan must be higher tier than current plan');
    });

    it('should create payment record for prorated amount', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.plan.findUnique.mockResolvedValue(mockPremiumPlan);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        planId: mockPremiumPlan.id,
        plan: mockPremiumPlan,
      });

      await service.upgrade(mockSubscription.id, mockUser.id, upgradeDto);

      expect(prismaService.paymentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionId: mockSubscription.id,
            amount: 20, // 29.99 - 9.99
            status: 'PENDING',
          }),
        })
      );
    });

    it('should calculate correct prorated amount', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.plan.findUnique.mockResolvedValue(mockPremiumPlan);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        planId: mockPremiumPlan.id,
        plan: mockPremiumPlan,
        previousPlan: mockPlan,
      });

      const result = await service.upgrade(
        mockSubscription.id,
        mockUser.id,
        upgradeDto
      );

      expect(result.proratedAmount).toBe(20);
    });
  });

  describe('downgrade', () => {
    const downgradeDto: DowngradeSubscriptionDto = {
      newPlanId: mockPlan.id,
    };

    const premiumSubscription = {
      ...mockSubscription,
      planId: mockPremiumPlan.id,
      plan: mockPremiumPlan,
    };

    it('should successfully downgrade subscription', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(premiumSubscription);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.subscription.update.mockResolvedValue({
        ...premiumSubscription,
        planId: mockPlan.id,
        previousPlanId: mockPremiumPlan.id,
        plan: mockPlan,
        previousPlan: mockPremiumPlan,
      });

      const result = await service.downgrade(
        mockSubscription.id,
        mockUser.id,
        downgradeDto
      );

      expect(result.planId).toBe(mockPlan.id);
      expect(result).toHaveProperty('effectiveDate');
      expect(result).toHaveProperty('note');
    });

    it('should throw NotFoundException if subscription not found', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.downgrade(mockSubscription.id, mockUser.id, downgradeDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException if subscription not active', async () => {
      prismaService.subscription.findFirst.mockResolvedValue({
        ...premiumSubscription,
        status: 'PENDING',
      });

      await expect(
        service.downgrade(mockSubscription.id, mockUser.id, downgradeDto)
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException if new plan is not lower tier', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(premiumSubscription);
      prismaService.plan.findUnique.mockResolvedValue({
        ...mockPremiumPlan,
        price: 39.99, // Higher price
      });

      await expect(
        service.downgrade(mockSubscription.id, mockUser.id, downgradeDto)
      ).rejects.toThrow('New plan must be lower tier than current plan');
    });

    it('should set effective date one month in future', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(premiumSubscription);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.subscription.update.mockResolvedValue({
        ...premiumSubscription,
        planId: mockPlan.id,
        plan: mockPlan,
      });

      const result = await service.downgrade(
        mockSubscription.id,
        mockUser.id,
        downgradeDto
      );

      const now = new Date();
      const expected = new Date();
      expected.setMonth(expected.getMonth() + 1);

      expect(result.effectiveDate.getMonth()).toBe(expected.getMonth());
    });
  });

  describe('cancel', () => {
    it('should successfully cancel subscription', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
        endDate: new Date(),
      });

      const result = await service.cancel(mockSubscription.id, mockUser.id);

      expect(result.status).toBe('CANCELLED');
      expect(result.endDate).toBeDefined();
    });

    it('should throw NotFoundException if subscription not found', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(mockSubscription.id, mockUser.id)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException if already cancelled', async () => {
      prismaService.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
      });

      await expect(
        service.cancel(mockSubscription.id, mockUser.id)
      ).rejects.toThrow(UnprocessableEntityException);
      await expect(
        service.cancel(mockSubscription.id, mockUser.id)
      ).rejects.toThrow('Subscription is already cancelled');
    });

    it('should set endDate to current date', async () => {
      const now = new Date();
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
        endDate: now,
      });

      const result = await service.cancel(mockSubscription.id, mockUser.id);

      expect(result.endDate).toBeDefined();
    });
  });

  describe('calculateProration', () => {
    it('should calculate correct prorated amount', () => {
      const result = (service as any).calculateProration(9.99, 29.99);
      expect(result).toBe(20);
    });

    it('should return 0 if new price is lower', () => {
      const result = (service as any).calculateProration(29.99, 9.99);
      expect(result).toBe(0);
    });

    it('should handle decimal values correctly', () => {
      const result = (service as any).calculateProration(9.99, 19.99);
      expect(result).toBe(10);
    });

    it('should handle equal prices', () => {
      const result = (service as any).calculateProration(9.99, 9.99);
      expect(result).toBe(0);
    });
  });

  describe('mapToResponse', () => {
    it('should correctly map subscription to response DTO', () => {
      const mapped = (service as any).mapToResponse(mockSubscription);

      expect(mapped).toHaveProperty('id', mockSubscription.id);
      expect(mapped).toHaveProperty('userId', mockUser.id);
      expect(mapped).toHaveProperty('plan');
      expect(mapped.plan.price).toBe(mockPlan.price);
    });

    it('should handle null previousPlan', () => {
      const mapped = (service as any).mapToResponse(mockSubscription);

      expect(mapped.previousPlan).toBeNull();
    });

    it('should map payment records if present', () => {
      const subWithPayments = {
        ...mockSubscription,
        paymentRecords: [
          {
            id: 'pay-1',
            amount: 9.99,
            currency: 'USD',
            status: 'SUCCESS',
            createdAt: new Date(),
          },
        ],
      };

      const mapped = (service as any).mapToResponse(subWithPayments);

      expect(mapped.paymentRecords).toHaveLength(1);
      expect(mapped.paymentRecords[0].amount).toBe(9.99);
    });

    it('should convert Prisma Decimal to number', () => {
      const subWithDecimal = {
        ...mockSubscription,
        plan: {
          ...mockPlan,
          price: { toString: () => '9.99' },
        },
      };

      const mapped = (service as any).mapToResponse(subWithDecimal);

      expect(typeof mapped.plan.price).toBe('number');
      expect(mapped.plan.price).toBe(9.99);
    });
  });
});

