/**
 * Jest environment setup for Payment Service
 * This file runs BEFORE Jest is initialized (setupFiles)
 * Loads environment variables from .env.test file if it exists (for integration tests)
 * Provides defaults for unit tests (which use mocks and don't need real env vars)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../../../../.env.test');

// Try to load .env.test - it's optional for unit tests, required for integration tests
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    console.warn('⚠️  Warning loading .env.test:', result.error.message);
  }
}

process.env.NODE_ENV = 'test';

// Use DATABASE_URL_PAYMENT if available (for integration tests with separate schemas)
if (process.env.DATABASE_URL_PAYMENT) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_PAYMENT;
}

// Provide default values for unit tests (will be overridden by .env.test if it exists)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
}
if (!process.env.API_KEY) {
  process.env.API_KEY = 'test-api-key';
}
if (!process.env.WEBHOOK_SECRET) {
  process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-for-unit-tests-32-chars';
}
if (!process.env.SUBSCRIPTION_SERVICE_WEBHOOK_URL) {
  process.env.SUBSCRIPTION_SERVICE_WEBHOOK_URL = 'http://localhost:3000/v1/webhooks/payment';
}