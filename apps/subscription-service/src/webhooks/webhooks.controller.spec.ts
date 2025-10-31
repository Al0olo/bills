import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentWebhookDto, WebhookEventType } from './dto/payment-webhook.dto';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let webhooksService: jest.Mocked<WebhooksService>;
  let configService: jest.Mocked<ConfigService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockWebhookResponse = {
    received: true,
    processedAt: new Date(),
    subscriptionId: 'sub-123',
    newStatus: 'ACTIVE',
  };

  beforeEach(async () => {
    const mockWebhooksService = {
      processPaymentWebhook: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'WEBHOOK_SECRET') return 'test-secret';
        return null;
      }),
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
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        IdempotencyInterceptor,
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    webhooksService = module.get(WebhooksService);
    configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('receivePaymentWebhook', () => {
    const webhookDto: PaymentWebhookDto = {
      eventType: WebhookEventType.PAYMENT_COMPLETED,
      paymentId: 'pay-123',
      externalReference: 'sub-123',
      status: 'success',
      amount: 29.99,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };

    it('should be defined', () => {
      expect(controller.receivePaymentWebhook).toBeDefined();
    });

    it('should successfully receive and process payment webhook', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      const result = await controller.receivePaymentWebhook(webhookDto);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        webhookDto
      );
      expect(result).toEqual(mockWebhookResponse);
    });

    it('should pass webhook DTO to service', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      await controller.receivePaymentWebhook(webhookDto);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        webhookDto
      );
      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledTimes(1);
    });

    it('should return webhook processing result', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      const result = await controller.receivePaymentWebhook(webhookDto);

      expect(result).toHaveProperty('received', true);
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('subscriptionId');
      expect(result).toHaveProperty('newStatus');
    });

    it('should handle successful payment webhook', async () => {
      const successResponse = {
        ...mockWebhookResponse,
        newStatus: 'ACTIVE',
      };
      webhooksService.processPaymentWebhook.mockResolvedValue(successResponse);

      const result = await controller.receivePaymentWebhook(webhookDto);

      expect(result.newStatus).toBe('ACTIVE');
    });

    it('should handle failed payment webhook', async () => {
      const failedWebhookDto: PaymentWebhookDto = {
        ...webhookDto,
        eventType: WebhookEventType.PAYMENT_FAILED,
        status: 'failed',
      };
      const failedResponse = {
        ...mockWebhookResponse,
        newStatus: 'CANCELLED',
      };
      webhooksService.processPaymentWebhook.mockResolvedValue(failedResponse);

      const result = await controller.receivePaymentWebhook(failedWebhookDto);

      expect(result.newStatus).toBe('CANCELLED');
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Subscription not found for payment reference');
      webhooksService.processPaymentWebhook.mockRejectedValue(error);

      await expect(
        controller.receivePaymentWebhook(webhookDto)
      ).rejects.toThrow(error);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      webhooksService.processPaymentWebhook.mockRejectedValue(error);

      await expect(
        controller.receivePaymentWebhook(webhookDto)
      ).rejects.toThrow(error);
    });

    it('should handle webhook with all required fields', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      await controller.receivePaymentWebhook(webhookDto);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: WebhookEventType.PAYMENT_COMPLETED,
          paymentId: 'pay-123',
          externalReference: 'sub-123',
          status: 'success',
          amount: 29.99,
          currency: 'USD',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle webhook with metadata', async () => {
      const webhookWithMetadata: PaymentWebhookDto = {
        ...webhookDto,
        metadata: {
          userId: 'user-123',
          planId: 'plan-123',
        },
      };
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      await controller.receivePaymentWebhook(webhookWithMetadata);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.any(Object),
        })
      );
    });

    it('should handle different currencies', async () => {
      const eurWebhook: PaymentWebhookDto = {
        ...webhookDto,
        currency: 'EUR',
      };
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      await controller.receivePaymentWebhook(eurWebhook);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'EUR',
        })
      );
    });

    it('should handle different payment amounts', async () => {
      const largeAmountWebhook: PaymentWebhookDto = {
        ...webhookDto,
        amount: 999.99,
      };
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      await controller.receivePaymentWebhook(largeAmountWebhook);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 999.99,
        })
      );
    });

    it('should handle different event types', async () => {
      const eventTypes = [WebhookEventType.PAYMENT_COMPLETED, WebhookEventType.PAYMENT_FAILED];

      for (const eventType of eventTypes) {
        const webhook: PaymentWebhookDto = {
          ...webhookDto,
          eventType,
        };
        webhooksService.processPaymentWebhook.mockResolvedValue(
          mockWebhookResponse
        );

        await controller.receivePaymentWebhook(webhook);

        expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType,
          })
        );
      }
    });

    it('should return processedAt timestamp', async () => {
      const now = new Date();
      webhooksService.processPaymentWebhook.mockResolvedValue({
        ...mockWebhookResponse,
        processedAt: now,
      });

      const result = await controller.receivePaymentWebhook(webhookDto);

      expect(result.processedAt).toEqual(now);
    });

    it('should return subscription ID', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      const result = await controller.receivePaymentWebhook(webhookDto);

      expect(result.subscriptionId).toBe('sub-123');
    });
  });

  describe('controller metadata', () => {
    it('should have correct route prefix', () => {
      const metadata = Reflect.getMetadata('path', WebhooksController);
      expect(metadata).toBe('v1/webhooks');
    });

    it('should have receivePaymentWebhook endpoint as POST payment', () => {
      const metadata = Reflect.getMetadata(
        'path',
        WebhooksController.prototype.receivePaymentWebhook
      );
      expect(metadata).toBe('payment');
    });
  });

  describe('error handling', () => {
    const webhookDto: PaymentWebhookDto = {
      eventType: WebhookEventType.PAYMENT_COMPLETED,
      paymentId: 'pay-123',
      externalReference: 'sub-123',
      status: 'success',
      amount: 29.99,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };

    it('should handle service timeout errors', async () => {
      const error = new Error('Request timeout');
      webhooksService.processPaymentWebhook.mockRejectedValue(error);

      await expect(
        controller.receivePaymentWebhook(webhookDto)
      ).rejects.toThrow('Request timeout');
    });

    it('should handle unexpected service errors', async () => {
      const error = new Error('Unexpected error');
      webhooksService.processPaymentWebhook.mockRejectedValue(error);

      await expect(
        controller.receivePaymentWebhook(webhookDto)
      ).rejects.toThrow('Unexpected error');
    });

    it('should handle validation errors from service', async () => {
      const error = new Error('Invalid webhook data');
      webhooksService.processPaymentWebhook.mockRejectedValue(error);

      await expect(
        controller.receivePaymentWebhook(webhookDto)
      ).rejects.toThrow(error);
    });

    it('should handle null response from service', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(null as any);

      const result = await controller.receivePaymentWebhook(webhookDto);

      expect(result).toBeNull();
    });
  });

  describe('idempotency', () => {
    const webhookDto: PaymentWebhookDto = {
      eventType: WebhookEventType.PAYMENT_COMPLETED,
      paymentId: 'pay-123',
      externalReference: 'sub-123',
      status: 'success',
      amount: 29.99,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };

    it('should handle duplicate webhook processing', async () => {
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      const result1 = await controller.receivePaymentWebhook(webhookDto);
      const result2 = await controller.receivePaymentWebhook(webhookDto);

      expect(result1).toEqual(result2);
      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledTimes(2);
    });
  });

  describe('webhook scenarios', () => {
    it('should handle upgrade payment webhook', async () => {
      const upgradeWebhook: PaymentWebhookDto = {
        eventType: WebhookEventType.PAYMENT_COMPLETED,
        paymentId: 'pay-upgrade-456',
        externalReference: 'sub-123',
        status: 'success',
        amount: 20, // Prorated amount
        currency: 'USD',
        timestamp: new Date().toISOString(),
        metadata: {
          type: 'upgrade',
          previousPlanId: 'plan-basic',
          newPlanId: 'plan-premium',
        },
      };
      webhooksService.processPaymentWebhook.mockResolvedValue(
        mockWebhookResponse
      );

      await controller.receivePaymentWebhook(upgradeWebhook);

      expect(webhooksService.processPaymentWebhook).toHaveBeenCalledWith(
        upgradeWebhook
      );
    });

    it('should handle initial subscription payment webhook', async () => {
      const initialWebhook: PaymentWebhookDto = {
        eventType: WebhookEventType.PAYMENT_COMPLETED,
        paymentId: 'pay-initial-789',
        externalReference: 'sub-new-123',
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        metadata: {
          type: 'initial',
        },
      };
      webhooksService.processPaymentWebhook.mockResolvedValue({
        ...mockWebhookResponse,
        subscriptionId: 'sub-new-123',
        newStatus: 'ACTIVE',
      });

      const result = await controller.receivePaymentWebhook(initialWebhook);

      expect(result.subscriptionId).toBe('sub-new-123');
      expect(result.newStatus).toBe('ACTIVE');
    });
  });
});

