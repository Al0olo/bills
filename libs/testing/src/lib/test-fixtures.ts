import { v4 as uuidv4 } from 'uuid';

/**
 * Factory function to create test user data
 */
export function createTestUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: uuidv4(),
    email: `test-${uuidv4()}@example.com`,
    name: 'Test User',
    passwordHash: '$2b$10$TestHashedPasswordXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Factory function to create test admin user data
 */
export function createTestAdminUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
}> = {}) {
  return createTestUser({
    role: 'admin',
    name: 'Test Admin',
    email: `admin-${uuidv4()}@example.com`,
    ...overrides,
  });
}

/**
 * Factory function to create test plan data
 */
export function createTestPlan(overrides: Partial<{
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: uuidv4(),
    name: `Test Plan ${uuidv4().substring(0, 8)}`,
    description: 'A test subscription plan',
    price: 29.99,
    billingCycle: 'MONTHLY' as const,
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Factory function to create test subscription data
 */
export function createTestSubscription(overrides: Partial<{
  id: string;
  userId: string;
  planId: string;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  startDate: Date;
  endDate: Date | null;
  paymentGatewayId: string | null;
  previousPlanId: string | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: uuidv4(),
    userId: uuidv4(),
    planId: uuidv4(),
    status: 'PENDING' as const,
    startDate: new Date(),
    endDate: null,
    paymentGatewayId: null,
    previousPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Factory function to create test payment record data
 */
export function createTestPaymentRecord(overrides: Partial<{
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paymentGatewayId: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: uuidv4(),
    subscriptionId: uuidv4(),
    amount: 29.99,
    currency: 'USD',
    status: 'PENDING' as const,
    paymentGatewayId: `pay_${uuidv4().substring(0, 8)}`,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Factory function to create test idempotency key data
 */
export function createTestIdempotencyKey(overrides: Partial<{
  id: string;
  idempotencyKey: string;
  requestMethod: string;
  requestPath: string;
  requestBodyHash: string;
  responseStatus: number | null;
  responseBody: any;
  createdAt: Date;
  expiresAt: Date;
}> = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  return {
    id: uuidv4(),
    idempotencyKey: `key_${uuidv4()}`,
    requestMethod: 'POST',
    requestPath: '/v1/test',
    requestBodyHash: generateHash(),
    responseStatus: null,
    responseBody: null,
    createdAt: now,
    expiresAt,
    ...overrides,
  };
}

/**
 * Factory function to create test payment transaction data (for payment service)
 */
export function createTestPaymentTransaction(overrides: Partial<{
  id: string;
  externalReference: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  failureReason: string | null;
  webhookSent: boolean;
  webhookRetryCount: number;
  webhookLastAttempt: Date | null;
  metadata: any;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: uuidv4(),
    externalReference: uuidv4(),
    amount: 29.99,
    currency: 'USD',
    status: 'PENDING' as const,
    failureReason: null,
    webhookSent: false,
    webhookRetryCount: 0,
    webhookLastAttempt: null,
    metadata: {},
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock hash for testing
 */
export function generateHash(): string {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${uuidv4()}`;
}

/**
 * Create multiple test entities
 */
export function createMany<T>(
  factory: (overrides?: any) => T,
  count: number,
  overrides: any[] = []
): T[] {
  return Array.from({ length: count }, (_, index) => 
    factory(overrides[index] || {})
  );
}

/**
 * Generate test password hash
 * Note: bcrypt is lazy-loaded to avoid native binding issues in unit tests
 */
export async function generateTestPasswordHash(password = 'Test1234!'): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 10);
}

/**
 * Create a complete test user with hashed password
 */
export async function createTestUserWithPassword(
  password = 'Test1234!',
  overrides: any = {}
) {
  const passwordHash = await generateTestPasswordHash(password);
  return createTestUser({
    passwordHash,
    ...overrides,
  });
}

/**
 * Create a complete test setup (user + plan + subscription)
 */
export function createTestSetup() {
  const user = createTestUser();
  const plan = createTestPlan();
  const subscription = createTestSubscription({
    userId: user.id,
    planId: plan.id,
  });
  const paymentRecord = createTestPaymentRecord({
    subscriptionId: subscription.id,
  });

  return {
    user,
    plan,
    subscription,
    paymentRecord,
  };
}

/**
 * Create test data for subscription upgrade scenario
 */
export function createUpgradeTestSetup() {
  const user = createTestUser();
  const basicPlan = createTestPlan({
    name: 'Basic Plan',
    price: 9.99,
  });
  const proPlan = createTestPlan({
    name: 'Pro Plan',
    price: 29.99,
  });
  const activeSubscription = createTestSubscription({
    userId: user.id,
    planId: basicPlan.id,
    status: 'ACTIVE',
    paymentGatewayId: 'pay_123',
  });

  return {
    user,
    basicPlan,
    proPlan,
    activeSubscription,
  };
}

/**
 * Create test data for subscription downgrade scenario
 */
export function createDowngradeTestSetup() {
  const user = createTestUser();
  const basicPlan = createTestPlan({
    name: 'Basic Plan',
    price: 9.99,
  });
  const proPlan = createTestPlan({
    name: 'Pro Plan',
    price: 29.99,
  });
  const activeSubscription = createTestSubscription({
    userId: user.id,
    planId: proPlan.id,
    status: 'ACTIVE',
    paymentGatewayId: 'pay_123',
  });

  return {
    user,
    basicPlan,
    proPlan,
    activeSubscription,
  };
}

