/**
 * Jest environment setup for Subscription Service
 * This file runs BEFORE Jest is initialized (setupFiles)
 * Loads environment variables from .env.test file using dotenv
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.test file from workspace root
const envPath = path.resolve(__dirname, '../../../../.env.test');

// Load .env.test with override to ensure test environment is used
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('❌ Error loading .env.test:', result.error.message);
  throw new Error('Failed to load test environment variables');
}

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

