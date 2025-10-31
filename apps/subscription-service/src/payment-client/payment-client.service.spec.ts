import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PaymentClientService } from './payment-client.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

describe('PaymentClientService', () => {
  let service: PaymentClientService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPaymentServiceUrl = 'http://payment-service:3001';
  const mockApiKey = 'test-api-key';

  const mockInitiatePaymentDto: InitiatePaymentDto = {
    externalReference: 'sub-123',
    amount: 29.99,
    currency: 'USD',
    metadata: {
      userId: 'user-123',
      planId: 'plan-123',
      planName: 'Basic Plan',
    },
  };

  const mockPaymentResponse = {
    id: 'pay-123',
    externalReference: 'sub-123',
    amount: 29.99,
    currency: 'USD',
    status: 'PENDING',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const mockConfigServiceInstance = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'payment.serviceUrl': mockPaymentServiceUrl,
          'payment.apiKey': mockApiKey,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentClientService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigServiceInstance,
        },
      ],
    }).compile();

    service = module.get<PaymentClientService>(PaymentClientService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load configuration on initialization', () => {
      expect(configService.get).toHaveBeenCalledWith('payment.serviceUrl');
      expect(configService.get).toHaveBeenCalledWith('payment.apiKey');
    });
  });

  describe('initiatePayment', () => {
    const idempotencyKey = 'key_123';

    it('should successfully initiate payment', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.initiatePayment(
        mockInitiatePaymentDto,
        idempotencyKey
      );

      expect(httpService.post).toHaveBeenCalledWith(
        `${mockPaymentServiceUrl}/v1/payments/initiate`,
        mockInitiatePaymentDto,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockPaymentResponse);
    });

    it('should include correct authorization header', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.initiatePayment(mockInitiatePaymentDto, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        })
      );
    });

    it('should include idempotency key in headers', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.initiatePayment(mockInitiatePaymentDto, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': idempotencyKey,
          }),
        })
      );
    });

    it('should send payment data in request body', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.initiatePayment(mockInitiatePaymentDto, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        mockInitiatePaymentDto,
        expect.any(Object)
      );
    });

    it('should throw HttpException on 400 error', async () => {
      const errorResponse = {
        message: 'Invalid request',
        statusCode: 400,
      };

      const axiosError = {
        response: {
          data: errorResponse,
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.initiatePayment(mockInitiatePaymentDto, idempotencyKey)
      ).rejects.toThrow(HttpException);
    });

    it('should throw HttpException on 500 error', async () => {
      const errorResponse = {
        message: 'Internal server error',
        statusCode: 500,
      };

      const axiosError = {
        response: {
          data: errorResponse,
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.initiatePayment(mockInitiatePaymentDto, idempotencyKey)
      ).rejects.toThrow(HttpException);
    });

    it('should handle network errors', async () => {
      const axiosError = {
        message: 'Network Error',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.initiatePayment(mockInitiatePaymentDto, idempotencyKey)
      ).rejects.toThrow(HttpException);
    });

    it('should handle timeout errors', async () => {
      const axiosError = {
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.initiatePayment(mockInitiatePaymentDto, idempotencyKey)
      ).rejects.toThrow();
    });

    it('should include metadata in payment request', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.initiatePayment(mockInitiatePaymentDto, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: 'user-123',
            planId: 'plan-123',
            planName: 'Basic Plan',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should return payment response with correct structure', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.initiatePayment(
        mockInitiatePaymentDto,
        idempotencyKey
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('externalReference');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('status');
    });

    it('should handle different payment amounts', async () => {
      const largeAmountDto = {
        ...mockInitiatePaymentDto,
        amount: 999.99,
      };

      const axiosResponse: AxiosResponse = {
        data: { ...mockPaymentResponse, amount: 999.99 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.initiatePayment(
        largeAmountDto,
        idempotencyKey
      );

      expect(result.amount).toBe(999.99);
    });

    it('should handle different currencies', async () => {
      const eurDto = {
        ...mockInitiatePaymentDto,
        currency: 'EUR',
      };

      const axiosResponse: AxiosResponse = {
        data: { ...mockPaymentResponse, currency: 'EUR' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.initiatePayment(eurDto, idempotencyKey);

      expect(result.currency).toBe('EUR');
    });
  });

  describe('getPaymentStatus', () => {
    const paymentId = 'pay-123';

    it('should successfully get payment status', async () => {
      const axiosResponse: AxiosResponse = {
        data: { ...mockPaymentResponse, status: 'SUCCESS' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.getPaymentStatus(paymentId);

      expect(httpService.get).toHaveBeenCalledWith(
        `${mockPaymentServiceUrl}/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
          },
        }
      );
      expect(result).toHaveProperty('status', 'SUCCESS');
    });

    it('should include correct authorization header', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(axiosResponse));

      await service.getPaymentStatus(paymentId);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        })
      );
    });

    it('should construct correct URL with payment ID', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(axiosResponse));

      await service.getPaymentStatus(paymentId);

      expect(httpService.get).toHaveBeenCalledWith(
        `${mockPaymentServiceUrl}/v1/payments/${paymentId}`,
        expect.any(Object)
      );
    });

    it('should throw HttpException on 404 error', async () => {
      const errorResponse = {
        message: 'Payment not found',
        statusCode: 404,
      };

      const axiosError = {
        response: {
          data: errorResponse,
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(service.getPaymentStatus(paymentId)).rejects.toThrow(
        HttpException
      );
    });

    it('should handle network errors', async () => {
      const axiosError = {
        message: 'Network Error',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(service.getPaymentStatus(paymentId)).rejects.toThrow(
        HttpException
      );
    });

    it('should return payment with different statuses', async () => {
      const statuses = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'];

      for (const status of statuses) {
        const axiosResponse: AxiosResponse = {
          data: { ...mockPaymentResponse, status },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        httpService.get.mockReturnValue(of(axiosResponse));

        const result = await service.getPaymentStatus(paymentId);
        expect(result.status).toBe(status);
      }
    });

    it('should handle unauthorized errors', async () => {
      const errorResponse = {
        message: 'Unauthorized',
        statusCode: 401,
      };

      const axiosError = {
        response: {
          data: errorResponse,
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(service.getPaymentStatus(paymentId)).rejects.toThrow(
        HttpException
      );
    });

    it('should return complete payment response', async () => {
      const completeResponse = {
        id: paymentId,
        externalReference: 'sub-123',
        amount: 29.99,
        currency: 'USD',
        status: 'SUCCESS',
        createdAt: new Date(),
        metadata: { test: 'data' },
      };

      const axiosResponse: AxiosResponse = {
        data: completeResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.getPaymentStatus(paymentId);

      expect(result).toEqual(completeResponse);
    });
  });

  describe('error handling', () => {
    it('should preserve error status code', async () => {
      const errorResponse = {
        message: 'Bad Request',
        statusCode: 400,
      };

      const axiosError = {
        response: {
          data: errorResponse,
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.initiatePayment(mockInitiatePaymentDto, 'key_123');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(400);
      }
    });

    it('should use default status 500 if no response', async () => {
      const axiosError = {
        message: 'Network Error',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.initiatePayment(mockInitiatePaymentDto, 'key_123');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(500);
      }
    });

    it('should preserve error response data', async () => {
      const errorResponse = {
        message: 'Validation error',
        errors: ['Invalid amount'],
        statusCode: 400,
      };

      const axiosError = {
        response: {
          data: errorResponse,
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      } as AxiosError;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.initiatePayment(mockInitiatePaymentDto, 'key_123');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getResponse()).toEqual(errorResponse);
      }
    });
  });

  describe('configuration', () => {
    it('should use configured payment service URL', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.initiatePayment(mockInitiatePaymentDto, 'key_123');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining(mockPaymentServiceUrl),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use configured API key', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockPaymentResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.initiatePayment(mockInitiatePaymentDto, 'key_123');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockApiKey}`,
          }),
        })
      );
    });
  });
});

