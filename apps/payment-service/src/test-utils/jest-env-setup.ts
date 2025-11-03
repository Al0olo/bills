/**
 * Jest environment setup for Payment Service
 * This file runs BEFORE Jest is initialized (setupFiles)
 * Loads environment variables from .env.test file using dotenv
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../../../.env.test');

const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  throw new Error('Failed to load test environment variables');
}

process.env.NODE_ENV = 'test';

if (process.env.DATABASE_URL_PAYMENT) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_PAYMENT;
}