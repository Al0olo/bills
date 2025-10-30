import { jest } from '@jest/globals';

/**
 * Service-specific mocks for Payment Service
 * These are mocks for services that are specific to the payment service
 */

/**
 * Mock WebhookClientService (for payment service)
 */
export class MockWebhookClientService {
  sendWebhook = jest.fn(async (url: string, data: any) => ({
    success: true,
    statusCode: 200,
  }));

  generateSignature = jest.fn((data: string) => 'mock-hmac-signature');
  
  retryWebhook = jest.fn(async (transactionId: string) => ({
    success: true,
    retryCount: 1,
  }));
}

