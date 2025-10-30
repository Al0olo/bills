import { jest } from '@jest/globals';

/**
 * Service-specific mocks for Subscription Service
 * These are mocks for services that are specific to the subscription service
 */

/**
 * Mock PaymentClientService
 */
export class MockPaymentClientService {
  initiatePayment = jest.fn(async (data: any) => ({
    id: 'pay_mock_123',
    externalReference: data.externalReference,
    amount: data.amount,
    currency: data.currency,
    status: 'PENDING',
    createdAt: new Date(),
  }));

  getPaymentStatus = jest.fn(async (paymentId: string) => ({
    id: paymentId,
    status: 'SUCCESS',
    amount: 29.99,
  }));
}

