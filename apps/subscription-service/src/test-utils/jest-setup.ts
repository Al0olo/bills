/**
 * Jest setup file for Subscription Service
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
  'postgresql://postgres:postgres_test@localhost:5433/subscriptions_test_db?schema=subscriptions';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3334';
process.env.PAYMENT_SERVICE_API_KEY = process.env.PAYMENT_SERVICE_API_KEY || 'test-payment-api-key';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret-32-chars-min';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Silence console during tests (optional - comment out if you want to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test cleanup
afterAll(async () => {
  // Add any global cleanup here
});

