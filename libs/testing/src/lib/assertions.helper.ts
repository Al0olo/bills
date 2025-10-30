import { expect } from '@jest/globals';

/**
 * Custom assertions for subscription/payment testing
 */

/**
 * Assert that a subscription has the expected structure
 */
export function assertSubscriptionStructure(subscription: any) {
  expect(subscription).toHaveProperty('id');
  expect(subscription).toHaveProperty('userId');
  expect(subscription).toHaveProperty('planId');
  expect(subscription).toHaveProperty('status');
  expect(subscription).toHaveProperty('startDate');
  expect(subscription).toHaveProperty('createdAt');
  expect(subscription).toHaveProperty('updatedAt');

  expect(typeof subscription.id).toBe('string');
  expect(typeof subscription.userId).toBe('string');
  expect(typeof subscription.planId).toBe('string');
  expect(['PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED']).toContain(subscription.status);
}

/**
 * Assert that a plan has the expected structure
 */
export function assertPlanStructure(plan: any) {
  expect(plan).toHaveProperty('id');
  expect(plan).toHaveProperty('name');
  expect(plan).toHaveProperty('price');
  expect(plan).toHaveProperty('billingCycle');
  expect(plan).toHaveProperty('isActive');
  expect(plan).toHaveProperty('createdAt');
  expect(plan).toHaveProperty('updatedAt');

  expect(typeof plan.id).toBe('string');
  expect(typeof plan.name).toBe('string');
  expect(typeof plan.price).toBe('number');
  expect(['MONTHLY', 'YEARLY']).toContain(plan.billingCycle);
  expect(typeof plan.isActive).toBe('boolean');
}

/**
 * Assert that a user has the expected structure
 */
export function assertUserStructure(user: any) {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('name');
  expect(user).toHaveProperty('createdAt');
  expect(user).toHaveProperty('updatedAt');

  // Should NOT expose password hash
  expect(user).not.toHaveProperty('passwordHash');
  expect(user).not.toHaveProperty('password');

  expect(typeof user.id).toBe('string');
  expect(typeof user.email).toBe('string');
  expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  expect(typeof user.name).toBe('string');
}

/**
 * Assert that a payment record has the expected structure
 */
export function assertPaymentRecordStructure(paymentRecord: any) {
  expect(paymentRecord).toHaveProperty('id');
  expect(paymentRecord).toHaveProperty('subscriptionId');
  expect(paymentRecord).toHaveProperty('amount');
  expect(paymentRecord).toHaveProperty('currency');
  expect(paymentRecord).toHaveProperty('status');
  expect(paymentRecord).toHaveProperty('createdAt');

  expect(typeof paymentRecord.id).toBe('string');
  expect(typeof paymentRecord.subscriptionId).toBe('string');
  expect(typeof paymentRecord.amount).toBe('number');
  expect(['PENDING', 'SUCCESS', 'FAILED']).toContain(paymentRecord.status);
}

/**
 * Assert that pagination metadata is correct
 */
export function assertPaginationMeta(meta: any, expectedTotal?: number) {
  expect(meta).toHaveProperty('page');
  expect(meta).toHaveProperty('limit');
  expect(meta).toHaveProperty('total');
  expect(meta).toHaveProperty('totalPages');
  expect(meta).toHaveProperty('hasNextPage');
  expect(meta).toHaveProperty('hasPreviousPage');

  expect(typeof meta.page).toBe('number');
  expect(typeof meta.limit).toBe('number');
  expect(typeof meta.total).toBe('number');
  expect(typeof meta.totalPages).toBe('number');
  expect(typeof meta.hasNextPage).toBe('boolean');
  expect(typeof meta.hasPreviousPage).toBe('boolean');

  expect(meta.page).toBeGreaterThan(0);
  expect(meta.limit).toBeGreaterThan(0);
  expect(meta.total).toBeGreaterThanOrEqual(0);

  if (expectedTotal !== undefined) {
    expect(meta.total).toBe(expectedTotal);
  }

  // Validate totalPages calculation
  const expectedTotalPages = Math.ceil(meta.total / meta.limit) || 1;
  expect(meta.totalPages).toBe(expectedTotalPages);

  // Validate hasNextPage
  if (meta.page < meta.totalPages) {
    expect(meta.hasNextPage).toBe(true);
  } else {
    expect(meta.hasNextPage).toBe(false);
  }

  // Validate hasPreviousPage
  if (meta.page > 1) {
    expect(meta.hasPreviousPage).toBe(true);
  } else {
    expect(meta.hasPreviousPage).toBe(false);
  }
}

/**
 * Assert that an error response has the expected structure
 */
export function assertErrorResponse(
  error: any,
  expectedStatusCode: number,
  expectedMessage?: string
) {
  expect(error.response).toBeDefined();
  expect(error.response.statusCode).toBe(expectedStatusCode);

  if (expectedMessage) {
    expect(error.response.message).toContain(expectedMessage);
  }

  expect(error.response).toHaveProperty('timestamp');
  expect(error.response).toHaveProperty('path');
}

/**
 * Assert that a JWT token has the expected structure
 */
export function assertJwtTokenStructure(token: string) {
  expect(typeof token).toBe('string');
  const parts = token.split('.');
  expect(parts).toHaveLength(3);

  // Decode payload (without verification)
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  expect(payload).toHaveProperty('sub');
  expect(payload).toHaveProperty('iat');
  expect(payload).toHaveProperty('exp');
}

/**
 * Assert that an auth response has the expected structure
 */
export function assertAuthResponse(response: any) {
  expect(response).toHaveProperty('user');
  expect(response).toHaveProperty('accessToken');
  expect(response).toHaveProperty('refreshToken');
  expect(response).toHaveProperty('expiresIn');

  assertUserStructure(response.user);
  assertJwtTokenStructure(response.accessToken);
  expect(typeof response.refreshToken).toBe('string');
  expect(typeof response.expiresIn).toBe('number');
  expect(response.expiresIn).toBeGreaterThan(0);
}

/**
 * Assert that a date is recent (within last N seconds)
 */
export function assertDateRecent(date: Date | string, secondsAgo = 10) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = (now.getTime() - dateObj.getTime()) / 1000;
  
  expect(diff).toBeGreaterThanOrEqual(0);
  expect(diff).toBeLessThanOrEqual(secondsAgo);
}

/**
 * Assert that two dates are approximately equal (within tolerance)
 */
export function assertDatesApproximatelyEqual(
  date1: Date | string,
  date2: Date | string,
  toleranceMs = 1000
) {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const diff = Math.abs(d1.getTime() - d2.getTime());
  expect(diff).toBeLessThanOrEqual(toleranceMs);
}

/**
 * Assert that a UUID is valid
 */
export function assertValidUuid(uuid: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(uuid).toMatch(uuidRegex);
}

/**
 * Assert that an array is sorted by a specific field
 */
export function assertArraySortedBy(
  array: any[],
  field: string,
  order: 'asc' | 'desc' = 'asc'
) {
  for (let i = 1; i < array.length; i++) {
    const prev = array[i - 1][field];
    const curr = array[i][field];

    if (order === 'asc') {
      expect(prev <= curr).toBeTruthy();
    } else {
      expect(prev >= curr).toBeTruthy();
    }
  }
}

/**
 * Assert that webhook payload has the expected structure
 */
export function assertWebhookPayloadStructure(payload: any) {
  expect(payload).toHaveProperty('eventType');
  expect(payload).toHaveProperty('paymentId');
  expect(payload).toHaveProperty('externalReference');
  expect(payload).toHaveProperty('status');
  expect(payload).toHaveProperty('amount');
  expect(payload).toHaveProperty('currency');
  expect(payload).toHaveProperty('timestamp');

  expect(typeof payload.eventType).toBe('string');
  expect(typeof payload.paymentId).toBe('string');
  expect(typeof payload.externalReference).toBe('string');
  expect(['success', 'failed']).toContain(payload.status);
  expect(typeof payload.amount).toBe('number');
  expect(typeof payload.currency).toBe('string');
}

/**
 * Assert that HMAC signature is valid format
 */
export function assertValidHmacSignature(signature: string) {
  expect(typeof signature).toBe('string');
  expect(signature.length).toBeGreaterThan(0);
  // HMAC-SHA256 produces 64 hex characters
  expect(signature.length).toBe(64);
  expect(signature).toMatch(/^[0-9a-f]{64}$/i);
}

/**
 * Assert that subscription can be upgraded
 */
export function assertCanUpgrade(subscription: any, currentPlan: any, newPlan: any) {
  expect(subscription.status).toBe('ACTIVE');
  expect(newPlan.price).toBeGreaterThan(currentPlan.price);
}

/**
 * Assert that subscription can be downgraded
 */
export function assertCanDowngrade(subscription: any, currentPlan: any, newPlan: any) {
  expect(subscription.status).toBe('ACTIVE');
  expect(newPlan.price).toBeLessThan(currentPlan.price);
}

/**
 * Custom Jest matchers
 */
export const customMatchers = {
  toBeValidSubscription(received: any) {
    try {
      assertSubscriptionStructure(received);
      return {
        pass: true,
        message: () => 'Expected not to be a valid subscription',
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected to be a valid subscription: ${(error as Error).message}`,
      };
    }
  },

  toBeValidPlan(received: any) {
    try {
      assertPlanStructure(received);
      return {
        pass: true,
        message: () => 'Expected not to be a valid plan',
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected to be a valid plan: ${(error as Error).message}`,
      };
    }
  },

  toBeValidUser(received: any) {
    try {
      assertUserStructure(received);
      return {
        pass: true,
        message: () => 'Expected not to be a valid user',
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected to be a valid user: ${(error as Error).message}`,
      };
    }
  },

  toBeRecentDate(received: Date | string, secondsAgo = 10) {
    try {
      assertDateRecent(received, secondsAgo);
      return {
        pass: true,
        message: () => `Expected ${received} not to be recent`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${received} to be within last ${secondsAgo} seconds`,
      };
    }
  },
};

