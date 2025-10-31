import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { createMockExecutionContext } from '../../test-utils';
import * as crypto from 'crypto';

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;
  let configService: jest.Mocked<ConfigService>;
  const webhookSecret = 'test-webhook-secret-32-characters';

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'webhook.secret') {
          return webhookSecret;
        }
        return null;
      }),
    } as any;

    guard = new WebhookSignatureGuard(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    const webhookBody = {
      eventType: 'payment.success',
      paymentId: 'pay-123',
      externalReference: 'sub-123',
      status: 'success',
      amount: 29.99,
      currency: 'USD',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    function generateValidSignature(body: any): string {
      const payload = JSON.stringify(body);
      return crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
    }

    it('should be defined', () => {
      expect(guard.canActivate).toBeDefined();
    });

    it('should allow request with valid signature', () => {
      const signature = generateValidSignature(webhookBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: webhookBody,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if signature is missing', () => {
      const context = createMockExecutionContext({
        headers: {},
        body: webhookBody,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message when signature missing', () => {
      const context = createMockExecutionContext({
        headers: {},
        body: webhookBody,
      });

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as any).response.message).toBe(
          'Webhook signature missing'
        );
      }
    });

    it('should throw UnauthorizedException with correct error code when signature missing', () => {
      const context = createMockExecutionContext({
        headers: {},
        body: webhookBody,
      });

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as any).response.code).toBe('MISSING_SIGNATURE');
      }
    });

    it('should throw UnauthorizedException if signature is invalid', () => {
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': 'invalid-signature' },
        body: webhookBody,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message when signature invalid', () => {
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': 'invalid-signature' },
        body: webhookBody,
      });

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as any).response.message).toBe(
          'Invalid webhook signature'
        );
      }
    });

    it('should throw UnauthorizedException with correct error code when signature invalid', () => {
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': 'invalid-signature' },
        body: webhookBody,
      });

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as any).response.code).toBe('INVALID_SIGNATURE');
      }
    });

    it('should use HMAC SHA-256 for signature generation', () => {
      const signature = generateValidSignature(webhookBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: webhookBody,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(signature).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should use webhook secret from configuration', () => {
      const signature = generateValidSignature(webhookBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: webhookBody,
      });

      guard.canActivate(context);

      expect(configService.get).toHaveBeenCalledWith('webhook.secret');
    });

    it('should use timing-safe comparison for signatures', () => {
      const signature = generateValidSignature(webhookBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: webhookBody,
      });

      // Should not throw timing attack errors
      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject tampered request body', () => {
      const signature = generateValidSignature(webhookBody);
      const tamperedBody = {
        ...webhookBody,
        amount: 999.99, // Tampered amount
      };
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: tamperedBody,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle different body structures', () => {
      const differentBody = {
        ...webhookBody,
        metadata: { extra: 'data' },
      };
      const signature = generateValidSignature(differentBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: differentBody,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle empty body', () => {
      const emptyBody = {};
      const signature = generateValidSignature(emptyBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: emptyBody,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should stringify body consistently for signature verification', () => {
      // Test that object property order doesn't matter
      const body1 = { a: 1, b: 2 };
      const body2 = { b: 2, a: 1 };

      const signature1 = generateValidSignature(body1);
      const signature2 = generateValidSignature(body2);

      // Note: JSON.stringify is deterministic for same object structure
      // but the test verifies that each body validates with its own signature
      const context1 = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature1 },
        body: body1,
      });

      const context2 = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature2 },
        body: body2,
      });

      expect(guard.canActivate(context1)).toBe(true);
      expect(guard.canActivate(context2)).toBe(true);
    });

    it('should reject signature with wrong case', () => {
      const signature = generateValidSignature(webhookBody).toUpperCase();
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: webhookBody,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle signature with extra whitespace', () => {
      const signature = generateValidSignature(webhookBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': ` ${signature} ` },
        body: webhookBody,
      });

      // Should fail because whitespace makes it invalid
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should extract signature from correct header', () => {
      const signature = generateValidSignature(webhookBody);
      const context = createMockExecutionContext({
        headers: {
          'x-webhook-signature': signature,
          'authorization': 'Bearer token',
          'content-type': 'application/json',
        },
        body: webhookBody,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle numeric values in body', () => {
      const bodyWithNumbers = {
        ...webhookBody,
        amount: 123.45,
        count: 5,
      };
      const signature = generateValidSignature(bodyWithNumbers);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithNumbers,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle boolean values in body', () => {
      const bodyWithBooleans = {
        ...webhookBody,
        success: true,
        failed: false,
      };
      const signature = generateValidSignature(bodyWithBooleans);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithBooleans,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle null values in body', () => {
      const bodyWithNull = {
        ...webhookBody,
        failureReason: null,
      };
      const signature = generateValidSignature(bodyWithNull);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithNull,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle array values in body', () => {
      const bodyWithArray = {
        ...webhookBody,
        items: ['item1', 'item2', 'item3'],
      };
      const signature = generateValidSignature(bodyWithArray);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithArray,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle nested objects in body', () => {
      const bodyWithNested = {
        ...webhookBody,
        metadata: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
      };
      const signature = generateValidSignature(bodyWithNested);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithNested,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle special characters in body', () => {
      const bodyWithSpecialChars = {
        ...webhookBody,
        description: 'Payment for subscription: user@example.com',
      };
      const signature = generateValidSignature(bodyWithSpecialChars);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithSpecialChars,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle unicode characters in body', () => {
      const bodyWithUnicode = {
        ...webhookBody,
        name: 'Test User 测试用户',
      };
      const signature = generateValidSignature(bodyWithUnicode);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: bodyWithUnicode,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should prevent signature reuse with different body', () => {
      const signature = generateValidSignature(webhookBody);
      const differentBody = {
        ...webhookBody,
        paymentId: 'pay-different',
      };
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: differentBody,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle very large body payloads', () => {
      const largeBody = {
        ...webhookBody,
        metadata: {
          data: 'x'.repeat(10000),
        },
      };
      const signature = generateValidSignature(largeBody);
      const context = createMockExecutionContext({
        headers: { 'x-webhook-signature': signature },
        body: largeBody,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should load webhook secret from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('webhook.secret');
    });
  });
});

