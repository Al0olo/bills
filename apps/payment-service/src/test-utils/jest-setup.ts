/**
 * Jest setup file for Payment Service
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

// Global test cleanup
afterAll(async () => {
  // Add any global cleanup here
});

