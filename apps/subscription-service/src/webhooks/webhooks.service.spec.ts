import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prismaService: any;

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    planId: 'plan-123',
    status: 'PENDING',
    startDate: new Date(),
    endDate: null,
    paymentGatewayId: null,
    previousPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentRecord = {
    id: 'payment-record-123',
    subscriptionId: 'sub-123',
    amount: 29.99,
    currency: 'USD',
    status: 'PENDING',
    paymentGatewayId: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      executeTransaction: jest.fn((callback) => callback(mockPrismaService)),
      subscription: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      paymentRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPaymentWebhook', () => {
    const successWebhookDto: PaymentWebhookDto = {
      eventType: 'payment.success',
      paymentId: 'pay-123',
      externalReference: 'sub-123',
      status: 'success',
      amount: 29.99,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };

    it('should successfully process successful payment webhook', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
        paymentGatewayId: successWebhookDto.paymentId,
      });
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue({
        ...mockPaymentRecord,
        status: 'SUCCESS',
      });

      const result = await service.processPaymentWebhook(successWebhookDto);

      expect(result).toEqual({
        received: true,
        processedAt: expect.any(Date),
        subscriptionId: 'sub-123',
        newStatus: 'ACTIVE',
      });
    });

    it('should update subscription status to ACTIVE on payment success', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: {
          status: 'ACTIVE',
          paymentGatewayId: successWebhookDto.paymentId,
        },
      });
    });

    it('should update payment record status to SUCCESS on payment success', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: mockPaymentRecord.id },
        data: {
          status: 'SUCCESS',
          paymentGatewayId: successWebhookDto.paymentId,
          failureReason: null,
        },
      });
    });

    it('should process failed payment webhook', async () => {
      const failedWebhookDto: PaymentWebhookDto = {
        ...successWebhookDto,
        eventType: 'payment.failed',
        status: 'failed',
      };

      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
      });
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      const result = await service.processPaymentWebhook(failedWebhookDto);

      expect(result.newStatus).toBe('CANCELLED');
    });

    it('should update subscription status to CANCELLED on payment failure', async () => {
      const failedWebhookDto: PaymentWebhookDto = {
        ...successWebhookDto,
        eventType: 'payment.failed',
        status: 'failed',
      };

      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(failedWebhookDto);

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: {
          status: 'CANCELLED',
          paymentGatewayId: failedWebhookDto.paymentId,
        },
      });
    });

    it('should update payment record status to FAILED on payment failure', async () => {
      const failedWebhookDto: PaymentWebhookDto = {
        ...successWebhookDto,
        eventType: 'payment.failed',
        status: 'failed',
      };

      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(failedWebhookDto);

      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: mockPaymentRecord.id },
        data: {
          status: 'FAILED',
          paymentGatewayId: failedWebhookDto.paymentId,
          failureReason: 'Payment processing failed',
        },
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.processPaymentWebhook(successWebhookDto)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.processPaymentWebhook(successWebhookDto)
      ).rejects.toThrow('Subscription not found for payment reference');
    });

    it('should throw NotFoundException with correct error code', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(null);

      try {
        await service.processPaymentWebhook(successWebhookDto);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as any).response.code).toBe('SUBSCRIPTION_NOT_FOUND');
        expect((error as any).response.details.externalReference).toBe(
          successWebhookDto.externalReference
        );
      }
    });

    it('should find subscription by external reference', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(null);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          id: successWebhookDto.externalReference,
        },
      });
    });

    it('should handle missing payment record gracefully', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });
      prismaService.paymentRecord.findFirst.mockResolvedValue(null);

      const result = await service.processPaymentWebhook(successWebhookDto);

      expect(result.received).toBe(true);
      expect(result.newStatus).toBe('ACTIVE');
      expect(prismaService.paymentRecord.update).not.toHaveBeenCalled();
    });

    it('should find most recent pending payment record', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.paymentRecord.findFirst).toHaveBeenCalledWith({
        where: {
          subscriptionId: mockSubscription.id,
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should execute all operations in a transaction', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.executeTransaction).toHaveBeenCalled();
    });

    it('should return correct response structure', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      const result = await service.processPaymentWebhook(successWebhookDto);

      expect(result).toHaveProperty('received', true);
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('subscriptionId', mockSubscription.id);
      expect(result).toHaveProperty('newStatus');
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it('should handle database errors', async () => {
      prismaService.subscription.findFirst.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.processPaymentWebhook(successWebhookDto)
      ).rejects.toThrow('Database error');
    });

    it('should update payment gateway ID on subscription', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(null);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentGatewayId: successWebhookDto.paymentId,
          }),
        })
      );
    });

    it('should update payment gateway ID on payment record', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentGatewayId: successWebhookDto.paymentId,
          }),
        })
      );
    });

    it('should handle concurrent webhooks with transaction isolation', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      const webhook1 = service.processPaymentWebhook(successWebhookDto);
      const webhook2 = service.processPaymentWebhook(successWebhookDto);

      const results = await Promise.all([webhook1, webhook2]);

      expect(results).toHaveLength(2);
      expect(prismaService.executeTransaction).toHaveBeenCalledTimes(2);
    });

    it('should set failure reason for failed payments', async () => {
      const failedWebhookDto: PaymentWebhookDto = {
        ...successWebhookDto,
        status: 'failed',
      };

      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(failedWebhookDto);

      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureReason: 'Payment processing failed',
          }),
        })
      );
    });

    it('should not set failure reason for successful payments', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockResolvedValue(mockSubscription);
      prismaService.paymentRecord.findFirst.mockResolvedValue(mockPaymentRecord);
      prismaService.paymentRecord.update.mockResolvedValue(mockPaymentRecord);

      await service.processPaymentWebhook(successWebhookDto);

      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureReason: null,
          }),
        })
      );
    });

    it('should handle rollback on transaction failure', async () => {
      prismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaService.subscription.update.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        service.processPaymentWebhook(successWebhookDto)
      ).rejects.toThrow('Update failed');
    });
  });
});

