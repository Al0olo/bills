import { PrismaClient } from '@prisma/client';
import { cleanupDatabase as genericCleanup } from '@bills/testing';
import { execSync } from 'child_process';

let prisma: PrismaClient;

/**
 * Tables in subscription service database (in order for cleanup)
 */
export const SUBSCRIPTION_SERVICE_TABLES = [
  'payment_records',
  'subscriptions',
  'idempotency_keys',
  'plans',
  'users',
];

/**
 * Get or create a Prisma test client for subscription service
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
    });
  }
  return prisma;
}

/**
 * Clean up all test data from the subscription service database
 * Use this in afterEach or afterAll hooks
 */
export async function cleanupDatabase() {
  const testPrisma = getTestPrisma();
  await genericCleanup(testPrisma, SUBSCRIPTION_SERVICE_TABLES);
}

/**
 * Disconnect from test database
 * Use this in afterAll hook
 */
export async function disconnectTestDb() {
  if (prisma) {
    await prisma.$disconnect();
  }
}

/**
 * Reset test database to initial state (run migrations)
 * WARNING: This will delete all data
 */
export async function resetTestDatabase() {
  try {
    execSync('pnpm prisma migrate reset --force --skip-seed --schema=./apps/subscription-service/prisma/schema.prisma', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}

/**
 * Seed test database with sample data
 */
export async function seedTestDatabase() {
  try {
    execSync('pnpm prisma db seed --schema=./apps/subscription-service/prisma/schema.prisma', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

