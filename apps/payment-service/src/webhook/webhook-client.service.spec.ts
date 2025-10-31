import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { WebhookClientService, WebhookPayload } from './webhook-client.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import * as crypto from 'crypto';

describe('WebhookClientService', () => {
  let service: WebhookClientService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockWebhookUrl = 'http://subscription-service:3000/v1/webhooks/payment';
  const mockWebhookSecret = 'test-webhook-secret';
  const mockRetryAttempts = 3;
  const mockRetryDelay = 100;

  const mockWebhookPayload: WebhookPayload = {
    eventType: 'payment.completed',
    paymentId: 'pay-123',
    externalReference: 'sub-123',
    status: 'success',
    amount: 29.99,
    currency: 'USD',
    timestamp: '2024-01-01T00:00:00.000Z',
    metadata: {
      userId: 'user-123',
      planId: 'plan-123',
    },
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const mockHttpService = {
      post: jest.fn(),
    };

    const mockConfigServiceInstance = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'webhook.subscriptionServiceUrl': mockWebhookUrl,
          'webhook.secret': mockWebhookSecret,
          'webhook.retryAttempts': mockRetryAttempts,
          'webhook.retryDelay': mockRetryDelay,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookClientService,
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

    service = module.get<WebhookClientService>(WebhookClientService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('sendWebhook', () => {
    const idempotencyKey = 'webhook_pay-123_123456789';

    function generateExpectedSignature(payload: any): string {
      const payloadString = JSON.stringify(payload);
      return crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(payloadString)
        .digest('hex');
    }

    it('should successfully send webhook on first attempt', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(1);
    });

    it('should include correct headers in webhook request', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(mockWebhookPayload, idempotencyKey);

      const expectedSignature = generateExpectedSignature(mockWebhookPayload);

      expect(httpService.post).toHaveBeenCalledWith(
        mockWebhookUrl,
        mockWebhookPayload,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': expectedSignature,
            'Idempotency-Key': idempotencyKey,
          },
        })
      );
    });

    it('should include timeout in request config', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(mockWebhookPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('should retry on failure', async () => {
      const error = new Error('Network error');

      httpService.post
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(
          of({
            data: { received: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          })
        );

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      // Fast-forward through retry delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const error = new Error('Network error');

      httpService.post
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(
          of({
            data: { received: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          })
        );

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      // Verify exponential backoff delays:
      // 1st retry: retryDelay * 2^0 = 100ms
      // 2nd retry: retryDelay * 2^1 = 200ms

      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(200);

      await resultPromise;
    });

    it('should return false after all retry attempts fail', async () => {
      const error = new Error('Network error');
      httpService.post.mockReturnValue(throwError(() => error));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
      expect(httpService.post).toHaveBeenCalledTimes(mockRetryAttempts);
    });

    it('should handle HTTP error responses', async () => {
      const axiosError: AxiosError = {
        response: {
          data: { error: 'Bad Request' },
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
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      httpService.post.mockReturnValue(throwError(() => timeoutError));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('should handle non-200 status codes', async () => {
      const axiosResponse: AxiosResponse = {
        data: { error: 'Server Error' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('should send payment.completed event', async () => {
      const completedPayload: WebhookPayload = {
        ...mockWebhookPayload,
        eventType: 'payment.completed',
        status: 'success',
      };

      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(completedPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventType: 'payment.completed',
          status: 'success',
        }),
        expect.any(Object)
      );
    });

    it('should send payment.failed event', async () => {
      const failedPayload: WebhookPayload = {
        ...mockWebhookPayload,
        eventType: 'payment.failed',
        status: 'failed',
      };

      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(failedPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventType: 'payment.failed',
          status: 'failed',
        }),
        expect.any(Object)
      );
    });

    it('should include metadata in webhook payload', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(mockWebhookPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: mockWebhookPayload.metadata,
        }),
        expect.any(Object)
      );
    });

    it('should handle webhook without metadata', async () => {
      const payloadWithoutMetadata: WebhookPayload = {
        ...mockWebhookPayload,
        metadata: undefined,
      };

      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.sendWebhook(
        payloadWithoutMetadata,
        idempotencyKey
      );

      expect(result).toBe(true);
    });

    it('should generate correct HMAC signature', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(mockWebhookPayload, idempotencyKey);

      const expectedSignature = generateExpectedSignature(mockWebhookPayload);
      const callArgs = httpService.post.mock.calls[0];
      const headers = callArgs[2]?.headers;

      expect(headers?.['X-Webhook-Signature']).toBe(expectedSignature);
    });

    it('should use different signatures for different payloads', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      const payload1 = { ...mockWebhookPayload, paymentId: 'pay-1' };
      const payload2 = { ...mockWebhookPayload, paymentId: 'pay-2' };

      await service.sendWebhook(payload1, idempotencyKey);
      const signature1 = httpService.post.mock.calls[0][2]?.headers?.[
        'X-Webhook-Signature'
      ];

      await service.sendWebhook(payload2, idempotencyKey);
      const signature2 = httpService.post.mock.calls[1][2]?.headers?.[
        'X-Webhook-Signature'
      ];

      expect(signature1).not.toBe(signature2);
    });

    it('should send to configured webhook URL', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(mockWebhookPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        mockWebhookUrl,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should include idempotency key in request', async () => {
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(mockWebhookPayload, idempotencyKey);

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

    it('should handle different currencies', async () => {
      const eurPayload: WebhookPayload = {
        ...mockWebhookPayload,
        currency: 'EUR',
      };

      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(eurPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          currency: 'EUR',
        }),
        expect.any(Object)
      );
    });

    it('should handle different amounts', async () => {
      const largeAmountPayload: WebhookPayload = {
        ...mockWebhookPayload,
        amount: 999.99,
      };

      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(axiosResponse));

      await service.sendWebhook(largeAmountPayload, idempotencyKey);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          amount: 999.99,
        }),
        expect.any(Object)
      );
    });
  });

  describe('constructor configuration', () => {
    it('should load webhook URL from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith(
        'webhook.subscriptionServiceUrl'
      );
    });

    it('should load webhook secret from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('webhook.secret');
    });

    it('should load retry attempts from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('webhook.retryAttempts');
    });

    it('should load retry delay from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('webhook.retryDelay');
    });

    it('should use default retry attempts if not configured', async () => {
      const mockConfigWithDefaults = {
        get: jest.fn((key: string) => {
          if (key === 'webhook.subscriptionServiceUrl') return mockWebhookUrl;
          if (key === 'webhook.secret') return mockWebhookSecret;
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WebhookClientService,
          {
            provide: HttpService,
            useValue: httpService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigWithDefaults,
          },
        ],
      }).compile();

      const serviceWithDefaults =
        module.get<WebhookClientService>(WebhookClientService);
      expect(serviceWithDefaults).toBeDefined();
    });
  });

  describe('retry behavior', () => {
    const idempotencyKey = 'webhook_pay-123_123456789';

    it('should stop retrying on success', async () => {
      const error = new Error('Network error');
      const axiosResponse: AxiosResponse = {
        data: { received: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(of(axiosResponse));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry more than configured attempts', async () => {
      const error = new Error('Network error');
      httpService.post.mockReturnValue(throwError(() => error));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      await resultPromise;

      expect(httpService.post).toHaveBeenCalledTimes(mockRetryAttempts);
      expect(httpService.post).not.toHaveBeenCalledTimes(
        mockRetryAttempts + 1
      );
    });

    it('should calculate exponential backoff correctly', async () => {
      const error = new Error('Network error');
      httpService.post.mockReturnValue(throwError(() => error));

      // Start the webhook send
      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      // First attempt happens immediately
      expect(httpService.post).toHaveBeenCalledTimes(1);

      // After 1st retry delay: retryDelay * 2^0 = 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(httpService.post).toHaveBeenCalledTimes(2);

      // After 2nd retry delay: retryDelay * 2^1 = 200ms
      await jest.advanceTimersByTimeAsync(200);
      expect(httpService.post).toHaveBeenCalledTimes(3);

      await resultPromise;
    });
  });

  describe('error scenarios', () => {
    const idempotencyKey = 'webhook_pay-123_123456789';

    it('should handle connection refused errors', async () => {
      const connectionError = new Error('Connection refused');
      httpService.post.mockReturnValue(throwError(() => connectionError));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('should handle DNS resolution errors', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND');
      httpService.post.mockReturnValue(throwError(() => dnsError));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('should handle 401 Unauthorized errors', async () => {
      const axiosError: AxiosError = {
        response: {
          data: { error: 'Unauthorized' },
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
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('should handle 503 Service Unavailable errors', async () => {
      const axiosError: AxiosError = {
        response: {
          data: { error: 'Service Unavailable' },
          status: 503,
          statusText: 'Service Unavailable',
          headers: {},
          config: {} as any,
        },
        message: 'Request failed',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      const resultPromise = service.sendWebhook(
        mockWebhookPayload,
        idempotencyKey
      );

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe(false);
    });
  });
});

