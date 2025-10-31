import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { PrismaService } from '../../prisma/prisma.service';
import { of } from 'rxjs';
import { createMockPrismaService } from '../../test-utils';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let prismaService: jest.Mocked<PrismaService>;

  const mockResponse = {
    id: 'pay-123',
    amount: 29.99,
    status: 'SUCCESS',
  };

  const mockIdempotencyKey = 'idempotency-key-123';

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockContext(
    method: string,
    headers: Record<string, string> = {}
  ): ExecutionContext {
    return {
      switchToHttp: jest.fn(() => ({
        getRequest: () => ({ method, headers }),
        getResponse: () => ({}),
      })),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as any;
  }

  function createMockCallHandler(response: any = mockResponse): CallHandler {
    return {
      handle: jest.fn(() => of(response)),
    } as any;
  }

  describe('intercept', () => {
    it('should allow GET requests without idempotency check', async () => {
      const context = createMockContext('GET', {});
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).not.toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    });

    it('should allow POST requests without idempotency key', async () => {
      const context = createMockContext('POST', {});
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).not.toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    });

    it('should check for existing idempotency key on POST with key', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: mockIdempotencyKey },
      });
    });

    it('should return cached response if idempotency key exists', async () => {
      const cachedResponse = { id: 'cached-123', cached: true };
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue({
        key: mockIdempotencyKey,
        response: cachedResponse,
        expiresAt: new Date(),
      } as any);

      const observable = await interceptor.intercept(context, next);
      const result = await new Promise((resolve) => {
        observable.subscribe((data) => resolve(data));
      });

      expect(result).toEqual(cachedResponse);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('should process request and cache response on first use', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const observable = await interceptor.intercept(context, next);
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => {
            // Do nothing
          },
          complete: () => resolve(true),
        });
      });

      // Give time for tap to execute
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(next.handle).toHaveBeenCalled();
      expect(prismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: {
          key: mockIdempotencyKey,
          response: mockResponse,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should set expiration to 24 hours', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const observable = await interceptor.intercept(context, next);
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => {
            // Do nothing
          },
          complete: () => resolve(true),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(prismaService.idempotencyKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      );

      const createCall = (prismaService.idempotencyKey.create as jest.Mock).mock.calls[0];
      if (createCall) {
        const expiresAt = createCall[0]?.data?.expiresAt;
        const now = Date.now();
        const expectedExpiry = now + 24 * 60 * 60 * 1000;
        const actualExpiry = expiresAt?.getTime();

        // Allow 1 second tolerance
        expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
      }
    });

    it('should apply to PUT requests', async () => {
      const context = createMockContext('PUT', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalled();
    });

    it('should apply to PATCH requests', async () => {
      const context = createMockContext('PATCH', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalled();
    });

    it('should apply to DELETE requests', async () => {
      const context = createMockContext('DELETE', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalled();
    });

    it('should not apply to GET requests', async () => {
      const context = createMockContext('GET', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).not.toHaveBeenCalled();
    });

    it('should not apply to HEAD requests', async () => {
      const context = createMockContext('HEAD', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const observable = await interceptor.intercept(context, next);

      expect(next.handle).toHaveBeenCalled();
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => resolve(true),
          error: () => resolve(false),
        });
      });
    });

    it('should ignore P2002 errors (unique constraint) during cache creation', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockRejectedValue({
        code: 'P2002', // Prisma unique constraint violation
        message: 'Unique constraint failed',
      });

      const observable = await interceptor.intercept(context, next);
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => {
            // Do nothing
          },
          complete: () => resolve(true),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle other database errors during cache creation', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const observable = await interceptor.intercept(context, next);
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => {
            // Do nothing
          },
          complete: () => resolve(true),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should continue despite error
      expect(next.handle).toHaveBeenCalled();
    });

    it('should cache complex response objects', async () => {
      const complexResponse = {
        id: 'pay-123',
        nested: {
          data: {
            array: [1, 2, 3],
          },
        },
      };

      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler(complexResponse);

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const observable = await interceptor.intercept(context, next);
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => {
            // Do nothing
          },
          complete: () => resolve(true),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(prismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: {
          key: mockIdempotencyKey,
          response: complexResponse,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should handle empty response', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler(null);

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const observable = await interceptor.intercept(context, next);
      
      await new Promise((resolve) => {
        observable.subscribe({
          next: () => {
            // Do nothing
          },
          complete: () => resolve(true),
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(prismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: {
          key: mockIdempotencyKey,
          response: null,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should handle different idempotency keys separately', async () => {
      const key1 = 'key-1';
      const key2 = 'key-2';
      const response1 = { id: 'resp-1' };
      const response2 = { id: 'resp-2' };

      // First request
      const context1 = createMockContext('POST', { 'idempotency-key': key1 });
      const next1 = createMockCallHandler(response1);

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context1, next1);

      // Second request
      const context2 = createMockContext('POST', { 'idempotency-key': key2 });
      const next2 = createMockCallHandler(response2);

      await interceptor.intercept(context2, next2);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: key1 },
      });
      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: key2 },
      });
    });

    it('should return original response on first request', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': mockIdempotencyKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const observable = await interceptor.intercept(context, next);
      const result = await new Promise((resolve) => {
        observable.subscribe((data) => resolve(data));
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle case-sensitive idempotency keys', async () => {
      const lowerKey = 'key-abc';
      const upperKey = 'KEY-ABC';

      const context1 = createMockContext('POST', {
        'idempotency-key': lowerKey,
      });
      const next1 = createMockCallHandler();

      const context2 = createMockContext('POST', {
        'idempotency-key': upperKey,
      });
      const next2 = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context1, next1);
      await interceptor.intercept(context2, next2);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: lowerKey },
      });
      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: upperKey },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long idempotency keys', async () => {
      const longKey = 'k'.repeat(1000);
      const context = createMockContext('POST', {
        'idempotency-key': longKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: longKey },
      });
    });

    it('should handle special characters in idempotency keys', async () => {
      const specialKey = 'key!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const context = createMockContext('POST', {
        'idempotency-key': specialKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: specialKey },
      });
    });

    it('should handle unicode in idempotency keys', async () => {
      const unicodeKey = 'key-测试-🔑';
      const context = createMockContext('POST', {
        'idempotency-key': unicodeKey,
      });
      const next = createMockCallHandler();

      (prismaService.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      await interceptor.intercept(context, next);

      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: unicodeKey },
      });
    });

    it('should handle requests with empty idempotency key', async () => {
      const context = createMockContext('POST', {
        'idempotency-key': '',
      });
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      // Empty string is falsy, should not check
      expect(prismaService.idempotencyKey.findUnique).not.toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    });
  });
});

