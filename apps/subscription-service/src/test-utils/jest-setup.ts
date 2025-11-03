/**
 * Jest setup file for Subscription Service
 * This file runs AFTER Jest is initialized (setupFilesAfterEnv)
 * - Custom matchers
 * - Global test utilities
 * - Timeouts
 */

import { customMatchers } from '@bills/testing';
import { jest, expect, afterAll } from '@jest/globals';

// Extend Jest matchers with custom matchers
expect.extend(customMatchers);

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

