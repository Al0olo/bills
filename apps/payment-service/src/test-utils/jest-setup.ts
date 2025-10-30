/**
 * Jest setup file for Payment Service
 * 
 * This file runs before all tests and sets up:
 * - Custom matchers
 * - Global test utilities
 * - Environment variables for testing
 */

import { customMatchers } from '@bills/testing';
import { jest, expect, afterAll } from '@jest/globals';

// Extend Jest matchers with custom matchers
expect.extend(customMatchers);

// Set test environment variables if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:postgres_test@localhost:5433/payments_test_db?schema=payment';
process.env.API_KEY = process.env.API_KEY || 'test-payment-api-key';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret-32-chars-min';
process.env.SUBSCRIPTION_SERVICE_WEBHOOK_URL = process.env.SUBSCRIPTION_SERVICE_WEBHOOK_URL || 
  'http://localhost:3333/v1/webhooks/payment';
process.env.PAYMENT_SUCCESS_RATE = process.env.PAYMENT_SUCCESS_RATE || '80';
process.env.PAYMENT_PROCESSING_DELAY_MS = process.env.PAYMENT_PROCESSING_DELAY_MS || '1000';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Global test cleanup
afterAll(async () => {
  // Add any global cleanup here
});

