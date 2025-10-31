import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockPaymentResponse: PaymentResponseDto = {
    id: 'pay-123',
    externalReference: 'sub-123',
    amount: 29.99,
    currency: 'USD',
    status: 'PENDING',
    failureReason: null,
    metadata: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    processedAt: null,
  };

  beforeEach(async () => {
    const mockPaymentsService = {
      initiatePayment: jest.fn(),
      getPayment: jest.fn(),
      getPaymentByReference: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    it('should be defined', () => {
      expect(controller.initiatePayment).toBeDefined();
    });

    it('should successfully initiate payment', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(paymentsService.initiatePayment).toHaveBeenCalledWith(
        initiatePaymentDto
      );
      expect(result).toEqual(mockPaymentResponse);
    });

    it('should pass DTO to service', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      await controller.initiatePayment(initiatePaymentDto);

      expect(paymentsService.initiatePayment).toHaveBeenCalledWith(
        initiatePaymentDto
      );
      expect(paymentsService.initiatePayment).toHaveBeenCalledTimes(1);
    });

    it('should return payment with PENDING status', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(result.status).toBe('PENDING');
    });

    it('should include external reference in response', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(result.externalReference).toBe(initiatePaymentDto.externalReference);
    });

    it('should include amount and currency in response', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(result.amount).toBe(initiatePaymentDto.amount);
      expect(result.currency).toBe(initiatePaymentDto.currency);
    });

    it('should include metadata in response', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(result.metadata).toBeDefined();
    });

    it('should propagate validation errors', async () => {
      const error = new Error('Validation failed');
      paymentsService.initiatePayment.mockRejectedValue(error);

      await expect(
        controller.initiatePayment(initiatePaymentDto)
      ).rejects.toThrow(error);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      paymentsService.initiatePayment.mockRejectedValue(error);

      await expect(
        controller.initiatePayment(initiatePaymentDto)
      ).rejects.toThrow(error);
    });

    it('should handle payment with different currencies', async () => {
      const eurDto = { ...initiatePaymentDto, currency: 'EUR' };
      const eurResponse = { ...mockPaymentResponse, currency: 'EUR' };
      paymentsService.initiatePayment.mockResolvedValue(eurResponse);

      const result = await controller.initiatePayment(eurDto);

      expect(result.currency).toBe('EUR');
    });

    it('should handle payment with different amounts', async () => {
      const largeAmountDto = { ...initiatePaymentDto, amount: 999.99 };
      const largeResponse = { ...mockPaymentResponse, amount: 999.99 };
      paymentsService.initiatePayment.mockResolvedValue(largeResponse);

      const result = await controller.initiatePayment(largeAmountDto);

      expect(result.amount).toBe(999.99);
    });

    it('should return payment ID', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(result.id).toBe('pay-123');
      expect(result.id).toBeDefined();
    });

    it('should return timestamps', async () => {
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(initiatePaymentDto);

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should handle payment without metadata', async () => {
      const dtoWithoutMetadata = {
        externalReference: 'sub-123',
        amount: 29.99,
        currency: 'USD',
      };
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.initiatePayment(dtoWithoutMetadata);

      expect(result).toBeDefined();
    });
  });

  describe('getPayment', () => {
    const paymentId = 'pay-123';

    it('should be defined', () => {
      expect(controller.getPayment).toBeDefined();
    });

    it('should successfully get payment by ID', async () => {
      paymentsService.getPayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.getPayment(paymentId);

      expect(paymentsService.getPayment).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockPaymentResponse);
    });

    it('should pass payment ID to service', async () => {
      paymentsService.getPayment.mockResolvedValue(mockPaymentResponse);

      await controller.getPayment(paymentId);

      expect(paymentsService.getPayment).toHaveBeenCalledWith(paymentId);
      expect(paymentsService.getPayment).toHaveBeenCalledTimes(1);
    });

    it('should return complete payment details', async () => {
      const completePayment: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'SUCCESS',
        processedAt: new Date(),
      };
      paymentsService.getPayment.mockResolvedValue(completePayment);

      const result = await controller.getPayment(paymentId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'SUCCESS');
      expect(result).toHaveProperty('processedAt');
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Payment not found');
      paymentsService.getPayment.mockRejectedValue(error);

      await expect(controller.getPayment(paymentId)).rejects.toThrow(error);
    });

    it('should return payment with different statuses', async () => {
      const statuses: Array<PaymentResponseDto['status']> = [
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'FAILED',
      ];

      for (const status of statuses) {
        const payment = { ...mockPaymentResponse, status };
        paymentsService.getPayment.mockResolvedValue(payment);

        const result = await controller.getPayment(paymentId);
        expect(result.status).toBe(status);
      }
    });

    it('should return failed payment with failure reason', async () => {
      const failedPayment: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'FAILED',
        failureReason: 'Payment declined',
      };
      paymentsService.getPayment.mockResolvedValue(failedPayment);

      const result = await controller.getPayment(paymentId);

      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('Payment declined');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      paymentsService.getPayment.mockRejectedValue(error);

      await expect(controller.getPayment(paymentId)).rejects.toThrow(error);
    });

    it('should handle different payment IDs', async () => {
      const testIds = ['pay-123', 'pay-456', 'pay-789'];

      for (const id of testIds) {
        const payment = { ...mockPaymentResponse, id };
        paymentsService.getPayment.mockResolvedValue(payment);

        const result = await controller.getPayment(id);
        expect(result.id).toBe(id);
      }
    });
  });

  describe('getPaymentByReference', () => {
    const reference = 'sub-123';

    it('should be defined', () => {
      expect(controller.getPaymentByReference).toBeDefined();
    });

    it('should successfully get payment by reference', async () => {
      paymentsService.getPaymentByReference.mockResolvedValue(
        mockPaymentResponse
      );

      const result = await controller.getPaymentByReference(reference);

      expect(paymentsService.getPaymentByReference).toHaveBeenCalledWith(
        reference
      );
      expect(result).toEqual(mockPaymentResponse);
    });

    it('should pass reference to service', async () => {
      paymentsService.getPaymentByReference.mockResolvedValue(
        mockPaymentResponse
      );

      await controller.getPaymentByReference(reference);

      expect(paymentsService.getPaymentByReference).toHaveBeenCalledWith(
        reference
      );
      expect(paymentsService.getPaymentByReference).toHaveBeenCalledTimes(1);
    });

    it('should return payment matching the reference', async () => {
      paymentsService.getPaymentByReference.mockResolvedValue(
        mockPaymentResponse
      );

      const result = await controller.getPaymentByReference(reference);

      expect(result.externalReference).toBe(reference);
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Payment not found for reference');
      paymentsService.getPaymentByReference.mockRejectedValue(error);

      await expect(
        controller.getPaymentByReference(reference)
      ).rejects.toThrow(error);
    });

    it('should handle different reference formats', async () => {
      const references = ['sub-123', 'subscription-456', 'ref_789'];

      for (const ref of references) {
        const payment = { ...mockPaymentResponse, externalReference: ref };
        paymentsService.getPaymentByReference.mockResolvedValue(payment);

        const result = await controller.getPaymentByReference(ref);
        expect(result.externalReference).toBe(ref);
      }
    });

    it('should handle special characters in reference', async () => {
      const specialRef = 'sub-123_test-2024';
      const payment = { ...mockPaymentResponse, externalReference: specialRef };
      paymentsService.getPaymentByReference.mockResolvedValue(payment);

      const result = await controller.getPaymentByReference(specialRef);

      expect(result.externalReference).toBe(specialRef);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      paymentsService.getPaymentByReference.mockRejectedValue(error);

      await expect(
        controller.getPaymentByReference(reference)
      ).rejects.toThrow(error);
    });
  });

  describe('controller metadata', () => {
    it('should have correct route prefix', () => {
      const metadata = Reflect.getMetadata('path', PaymentsController);
      expect(metadata).toBe('v1/payments');
    });

    it('should have initiatePayment endpoint as POST', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PaymentsController.prototype.initiatePayment
      );
      expect(metadata).toBe('');
    });

    it('should have getPayment endpoint as GET with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PaymentsController.prototype.getPayment
      );
      expect(metadata).toBe(':id');
    });

    it('should have getPaymentByReference endpoint as GET with reference/:reference', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PaymentsController.prototype.getPaymentByReference
      );
      expect(metadata).toBe('reference/:reference');
    });
  });

  describe('error handling', () => {
    it('should handle service timeout errors', async () => {
      const error = new Error('Request timeout');
      paymentsService.getPayment.mockRejectedValue(error);

      await expect(controller.getPayment('pay-123')).rejects.toThrow(
        'Request timeout'
      );
    });

    it('should handle unexpected service errors', async () => {
      const error = new Error('Unexpected error');
      paymentsService.initiatePayment.mockRejectedValue(error);

      await expect(
        controller.initiatePayment({
          externalReference: 'sub-123',
          amount: 29.99,
          currency: 'USD',
        })
      ).rejects.toThrow('Unexpected error');
    });

    it('should handle null response from service', async () => {
      paymentsService.getPayment.mockResolvedValue(null as any);

      const result = await controller.getPayment('pay-123');

      expect(result).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete payment lifecycle', async () => {
      const initiateDto: InitiatePaymentDto = {
        externalReference: 'sub-123',
        amount: 29.99,
        currency: 'USD',
        metadata: { userId: 'user-123' },
      };

      // Initiate payment
      const pendingPayment: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'PENDING',
      };
      paymentsService.initiatePayment.mockResolvedValue(pendingPayment);
      const initiated = await controller.initiatePayment(initiateDto);
      expect(initiated.status).toBe('PENDING');

      // Check payment status - processing
      const processingPayment: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'PROCESSING',
      };
      paymentsService.getPayment.mockResolvedValue(processingPayment);
      const processing = await controller.getPayment(initiated.id);
      expect(processing.status).toBe('PROCESSING');

      // Check payment status - success
      const successPayment: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'SUCCESS',
        processedAt: new Date(),
      };
      paymentsService.getPayment.mockResolvedValue(successPayment);
      const completed = await controller.getPayment(initiated.id);
      expect(completed.status).toBe('SUCCESS');
      expect(completed.processedAt).toBeDefined();
    });

    it('should handle failed payment scenario', async () => {
      const initiateDto: InitiatePaymentDto = {
        externalReference: 'sub-123',
        amount: 29.99,
        currency: 'USD',
      };

      // Initiate payment
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);
      const initiated = await controller.initiatePayment(initiateDto);

      // Check payment status - failed
      const failedPayment: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'FAILED',
        failureReason: 'Payment declined',
        processedAt: new Date(),
      };
      paymentsService.getPayment.mockResolvedValue(failedPayment);
      const failed = await controller.getPayment(initiated.id);
      
      expect(failed.status).toBe('FAILED');
      expect(failed.failureReason).toBe('Payment declined');
    });

    it('should handle lookup by reference after initiation', async () => {
      const initiateDto: InitiatePaymentDto = {
        externalReference: 'sub-123',
        amount: 29.99,
        currency: 'USD',
      };

      // Initiate payment
      paymentsService.initiatePayment.mockResolvedValue(mockPaymentResponse);
      await controller.initiatePayment(initiateDto);

      // Lookup by reference
      paymentsService.getPaymentByReference.mockResolvedValue(
        mockPaymentResponse
      );
      const found = await controller.getPaymentByReference('sub-123');

      expect(found.externalReference).toBe('sub-123');
    });
  });
});

