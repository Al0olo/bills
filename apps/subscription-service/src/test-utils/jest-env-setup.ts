/**
 * Jest environment setup for Subscription Service
 * This file runs BEFORE Jest is initialized (setupFiles)
 * Loads environment variables from .env.test file if it exists (for integration tests)
 * Provides defaults for unit tests (which use mocks and don't need real env vars)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.test file from workspace root (if it exists)
const envPath = path.resolve(__dirname, '../../../../.env.test');

// Try to load .env.test - it's optional for unit tests, required for integration tests
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    console.warn('⚠️  Warning loading .env.test:', result.error.message);
  }
}

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

// Provide default values for unit tests (will be overridden by .env.test if it exists)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests-minimum-32-chars';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-unit-tests-32-chars';
}
if (!process.env.JWT_EXPIRES_IN) {
  process.env.JWT_EXPIRES_IN = '1h';
}
if (!process.env.JWT_REFRESH_EXPIRES_IN) {
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
}
if (!process.env.WEBHOOK_SECRET) {
  process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-for-unit-tests-32-chars';
}
if (!process.env.PAYMENT_SERVICE_URL) {
  process.env.PAYMENT_SERVICE_URL = 'http://localhost:3001';
}
if (!process.env.PAYMENT_SERVICE_API_KEY) {
  process.env.PAYMENT_SERVICE_API_KEY = 'test-api-key';
}

