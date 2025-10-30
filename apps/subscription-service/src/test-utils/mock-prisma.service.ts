import { jest } from '@jest/globals';

/**
 * Mock PrismaService for Subscription Service unit testing
 * This is service-specific as it mocks the subscription service's Prisma models
 */
export class MockPrismaService {
  user = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  plan = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  subscription = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  paymentRecord = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  idempotencyKey = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };

  $transaction = jest.fn((callback: (prisma: MockPrismaService) => Promise<unknown>) => callback(this));
  $connect = jest.fn();
  $disconnect = jest.fn();
  $executeRaw = jest.fn();
  $executeRawUnsafe = jest.fn();
  $queryRaw = jest.fn();
  $queryRawUnsafe = jest.fn();
}

/**
 * Mock successful Prisma transaction
 */
export function mockSuccessfulTransaction(prisma: MockPrismaService, result: any) {
  prisma.$transaction.mockImplementation(async (callback) => {
    return callback(prisma);
  });
  return result;
}

/**
 * Mock failed Prisma transaction
 */
export function mockFailedTransaction(prisma: MockPrismaService, error: Error) {
  prisma.$transaction.mockRejectedValue(error);
}

