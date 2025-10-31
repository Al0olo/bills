import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookClientService } from '../webhook/webhook-client.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: any;
  let webhookClientService: jest.Mocked<WebhookClientService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPayment = {
    id: 'pay-123',
    externalReference: 'sub-123',
    amount: 29.99,
    currency: 'USD',
    status: 'PENDING',
    failureReason: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const mockPrismaService = {
      executeTransaction: jest.fn((callback) => callback(mockPrismaService)),
      paymentTransaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockWebhookClientService = {
      sendWebhook: jest.fn(),
    };

    const mockConfigServiceInstance = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'simulation.successRate': 80,
          'simulation.processingDelayMs': 100,
          'simulation.minDelayMs': 50,
          'simulation.maxDelayMs': 150,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WebhookClientService,
          useValue: mockWebhookClientService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigServiceInstance,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get(PrismaService);
    webhookClientService = module.get(WebhookClientService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initiatePayment', () => {
    const initiatePaymentDto: InitiatePaymentDto = {
      externalReference: 'sub-123',
      amount: 29.99,
      currency: 'USD',
      metadata: {
        userId: 'user-123',
        planId: 'plan-123',
      },
    };

    it('should successfully initiate payment', async () => {
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      const result = await service.initiatePayment(initiatePaymentDto);

      expect(prismaService.paymentTransaction.create).toHaveBeenCalledWith({
        data: {
          externalReference: initiatePaymentDto.externalReference,
          amount: initiatePaymentDto.amount,
          currency: initiatePaymentDto.currency,
          status: 'PENDING',
          metadata: initiatePaymentDto.metadata,
        },
      });
      expect(result).toEqual({
        id: mockPayment.id,
        externalReference: mockPayment.externalReference,
        amount: mockPayment.amount,
        currency: mockPayment.currency,
        status: mockPayment.status,
        failureReason: mockPayment.failureReason,
        metadata: mockPayment.metadata,
        createdAt: mockPayment.createdAt,
        updatedAt: mockPayment.updatedAt,
        processedAt: mockPayment.processedAt,
      });
    });

    it('should create payment with PENDING status', async () => {
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      await service.initiatePayment(initiatePaymentDto);

      expect(prismaService.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('should include metadata in payment creation', async () => {
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      await service.initiatePayment(initiatePaymentDto);

      expect(prismaService.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: initiatePaymentDto.metadata,
          }),
        })
      );
    });

    it('should handle missing metadata', async () => {
      const dtoWithoutMetadata = {
        ...initiatePaymentDto,
        metadata: undefined,
      };
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      await service.initiatePayment(dtoWithoutMetadata);

      expect(prismaService.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        })
      );
    });

    it('should execute payment creation in transaction', async () => {
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      await service.initiatePayment(initiatePaymentDto);

      expect(prismaService.executeTransaction).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      prismaService.paymentTransaction.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.initiatePayment(initiatePaymentDto)
      ).rejects.toThrow('Database error');
    });

    it('should return payment response with correct structure', async () => {
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      const result = await service.initiatePayment(initiatePaymentDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('externalReference');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should handle different currencies', async () => {
      const eurDto = { ...initiatePaymentDto, currency: 'EUR' };
      const eurPayment = { ...mockPayment, currency: 'EUR' };
      prismaService.paymentTransaction.create.mockResolvedValue(eurPayment);

      const result = await service.initiatePayment(eurDto);

      expect(result.currency).toBe('EUR');
    });

    it('should handle different amounts', async () => {
      const largeAmountDto = { ...initiatePaymentDto, amount: 999.99 };
      const largePayment = { ...mockPayment, amount: 999.99 };
      prismaService.paymentTransaction.create.mockResolvedValue(largePayment);

      const result = await service.initiatePayment(largeAmountDto);

      expect(result.amount).toBe(999.99);
    });
  });

  describe('getPayment', () => {
    const paymentId = 'pay-123';

    it('should successfully get payment by ID', async () => {
      prismaService.paymentTransaction.findUnique.mockResolvedValue(
        mockPayment
      );

      const result = await service.getPayment(paymentId);

      expect(prismaService.paymentTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: paymentId },
      });
      expect(result.id).toBe(paymentId);
    });

    it('should throw NotFoundException if payment not found', async () => {
      prismaService.paymentTransaction.findUnique.mockResolvedValue(null);

      await expect(service.getPayment(paymentId)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getPayment(paymentId)).rejects.toThrow(
        'Payment not found'
      );
    });

    it('should throw NotFoundException with correct error code', async () => {
      prismaService.paymentTransaction.findUnique.mockResolvedValue(null);

      try {
        await service.getPayment(paymentId);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as any).response.code).toBe('PAYMENT_NOT_FOUND');
      }
    });

    it('should return payment with all fields', async () => {
      const completePayment = {
        ...mockPayment,
        status: 'SUCCESS',
        processedAt: new Date(),
      };
      prismaService.paymentTransaction.findUnique.mockResolvedValue(
        completePayment
      );

      const result = await service.getPayment(paymentId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'SUCCESS');
      expect(result).toHaveProperty('processedAt');
    });

    it('should handle database errors', async () => {
      prismaService.paymentTransaction.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getPayment(paymentId)).rejects.toThrow(
        'Database error'
      );
    });

    it('should return payment with different statuses', async () => {
      const statuses = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'];

      for (const status of statuses) {
        const payment = { ...mockPayment, status };
        prismaService.paymentTransaction.findUnique.mockResolvedValue(payment);

        const result = await service.getPayment(paymentId);
        expect(result.status).toBe(status);
      }
    });

    it('should convert decimal amount to float', async () => {
      const decimalPayment = {
        ...mockPayment,
        amount: { toString: () => '29.99' }, // Simulating Prisma Decimal
      };
      prismaService.paymentTransaction.findUnique.mockResolvedValue(
        decimalPayment
      );

      const result = await service.getPayment(paymentId);

      expect(result.amount).toBe(29.99);
      expect(typeof result.amount).toBe('number');
    });
  });

  describe('getPaymentByReference', () => {
    const reference = 'sub-123';

    it('should successfully get payment by external reference', async () => {
      prismaService.paymentTransaction.findFirst.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByReference(reference);

      expect(prismaService.paymentTransaction.findFirst).toHaveBeenCalledWith({
        where: { externalReference: reference },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.externalReference).toBe(reference);
    });

    it('should return most recent payment for reference', async () => {
      prismaService.paymentTransaction.findFirst.mockResolvedValue(mockPayment);

      await service.getPaymentByReference(reference);

      expect(prismaService.paymentTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should throw NotFoundException if payment not found', async () => {
      prismaService.paymentTransaction.findFirst.mockResolvedValue(null);

      await expect(service.getPaymentByReference(reference)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getPaymentByReference(reference)).rejects.toThrow(
        'Payment not found for reference'
      );
    });

    it('should throw NotFoundException with correct error code', async () => {
      prismaService.paymentTransaction.findFirst.mockResolvedValue(null);

      try {
        await service.getPaymentByReference(reference);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as any).response.code).toBe('PAYMENT_NOT_FOUND');
      }
    });

    it('should handle database errors', async () => {
      prismaService.paymentTransaction.findFirst.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getPaymentByReference(reference)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('mapToResponse', () => {
    it('should map payment entity to response DTO', async () => {
      prismaService.paymentTransaction.findUnique.mockResolvedValue(
        mockPayment
      );

      const result = await service.getPayment('pay-123');

      expect(result).toEqual({
        id: mockPayment.id,
        externalReference: mockPayment.externalReference,
        amount: mockPayment.amount,
        currency: mockPayment.currency,
        status: mockPayment.status,
        failureReason: mockPayment.failureReason,
        metadata: mockPayment.metadata,
        createdAt: mockPayment.createdAt,
        updatedAt: mockPayment.updatedAt,
        processedAt: mockPayment.processedAt,
      });
    });

    it('should handle payment with failure reason', async () => {
      const failedPayment = {
        ...mockPayment,
        status: 'FAILED',
        failureReason: 'Payment declined',
      };
      prismaService.paymentTransaction.findUnique.mockResolvedValue(
        failedPayment
      );

      const result = await service.getPayment('pay-123');

      expect(result.failureReason).toBe('Payment declined');
    });

    it('should handle payment with metadata', async () => {
      const paymentWithMetadata = {
        ...mockPayment,
        metadata: { userId: 'user-123', extra: 'data' },
      };
      prismaService.paymentTransaction.findUnique.mockResolvedValue(
        paymentWithMetadata
      );

      const result = await service.getPayment('pay-123');

      expect(result.metadata).toEqual({ userId: 'user-123', extra: 'data' });
    });
  });

  describe('constructor configuration', () => {
    it('should load success rate from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('simulation.successRate');
    });

    it('should load processing delay from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith(
        'simulation.processingDelayMs'
      );
    });

    it('should load min delay from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('simulation.minDelayMs');
    });

    it('should load max delay from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('simulation.maxDelayMs');
    });

    it('should use default success rate if not configured', async () => {
      const mockConfigWithDefaults = {
        get: jest.fn(() => undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          {
            provide: PrismaService,
            useValue: prismaService,
          },
          {
            provide: WebhookClientService,
            useValue: webhookClientService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigWithDefaults,
          },
        ],
      }).compile();

      const serviceWithDefaults = module.get<PaymentsService>(PaymentsService);
      expect(serviceWithDefaults).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle payment with zero amount', async () => {
      const zeroAmountDto = {
        externalReference: 'sub-123',
        amount: 0,
        currency: 'USD',
      };
      const zeroPayment = { ...mockPayment, amount: 0 };
      prismaService.paymentTransaction.create.mockResolvedValue(zeroPayment);

      const result = await service.initiatePayment(zeroAmountDto);

      expect(result.amount).toBe(0);
    });

    it('should handle payment with very large amount', async () => {
      const largeAmountDto = {
        externalReference: 'sub-123',
        amount: 999999.99,
        currency: 'USD',
      };
      const largePayment = { ...mockPayment, amount: 999999.99 };
      prismaService.paymentTransaction.create.mockResolvedValue(largePayment);

      const result = await service.initiatePayment(largeAmountDto);

      expect(result.amount).toBe(999999.99);
    });

    it('should handle payment with empty metadata', async () => {
      const emptyMetadataDto = {
        externalReference: 'sub-123',
        amount: 29.99,
        currency: 'USD',
        metadata: {},
      };
      prismaService.paymentTransaction.create.mockResolvedValue(mockPayment);

      await service.initiatePayment(emptyMetadataDto);

      expect(prismaService.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        })
      );
    });

    it('should handle special characters in external reference', async () => {
      const specialRefDto = {
        externalReference: 'sub-123-test_2024',
        amount: 29.99,
        currency: 'USD',
      };
      const specialPayment = {
        ...mockPayment,
        externalReference: 'sub-123-test_2024',
      };
      prismaService.paymentTransaction.create.mockResolvedValue(
        specialPayment
      );

      const result = await service.initiatePayment(specialRefDto);

      expect(result.externalReference).toBe('sub-123-test_2024');
    });
  });
});

