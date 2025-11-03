import { JwtService } from '@nestjs/jwt';

/**
 * Test user credentials
 */
export const TEST_USERS = {
  admin: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'admin@test.com',
    password: 'Test1234!',
    name: 'Admin User',
    role: 'admin',
  },
  user1: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'user1@test.com',
    password: 'Test1234!',
    name: 'Test User 1',
    role: 'user',
  },
  user2: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'user2@test.com',
    password: 'Test1234!',
    name: 'Test User 2',
    role: 'user',
  },
  user3: {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'user3@test.com',
    password: 'Test1234!',
    name: 'Test User 3',
    role: 'user',
  },
  user4: {
    id: '550e8400-e29b-41d4-a716-446655440004',
    email: 'user4@test.com',
    password: 'Test1234!',
    name: 'Test User 4',
    role: 'user',
  },
};

/**
 * Generate a JWT token for testing
 */
export function generateTestToken(
  userId: string,
  email: string,
  role = 'user'
): string {
  const jwtService = new JwtService({
    secret: process.env['JWT_SECRET'] || 'test-jwt-secret-32-chars-minimum',
    signOptions: { expiresIn: '1h' },
  });

  return jwtService.sign({
    sub: userId,
    email,
    role,
  });
}

/**
 * Generate a refresh token for testing
 */
export function generateTestRefreshToken(
  userId: string,
  email: string,
  role = 'user'
): string {
  const jwtService = new JwtService({
    secret: process.env['JWT_REFRESH_SECRET'] || 'test-jwt-refresh-secret-32-chars',
    signOptions: { expiresIn: '7d' },
  });

  return jwtService.sign({
    sub: userId,
    email,
    role,
  });
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(
  userId: string,
  email: string,
  role = 'user'
): string {
  const jwtService = new JwtService({
    secret: process.env['JWT_SECRET'] || 'test-jwt-secret-32-chars-minimum',
    signOptions: { expiresIn: '-1h' }, // Expired 1 hour ago
  });

  return jwtService.sign({
    sub: userId,
    email,
    role,
  });
}

/**
 * Generate an invalid JWT token (wrong secret)
 */
export function generateInvalidToken(
  userId: string,
  email: string,
  role = 'user'
): string {
  const jwtService = new JwtService({
    secret: 'wrong-secret-key',
    signOptions: { expiresIn: '1h' },
  });

  return jwtService.sign({
    sub: userId,
    email,
    role,
  });
}

/**
 * Get authorization header for testing
 */
export function getAuthHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Get authorization header for a test user
 */
export function getTestUserAuthHeader(
  userKey: keyof typeof TEST_USERS = 'user1'
): { Authorization: string } {
  const user = TEST_USERS[userKey];
  const token = generateTestToken(user.id, user.email, user.role);
  return getAuthHeader(token);
}

/**
 * Get admin authorization header
 */
export function getAdminAuthHeader(): { Authorization: string } {
  return getTestUserAuthHeader('admin');
}

/**
 * Hash a password for testing (matches bcrypt used in app)
 * Note: bcrypt is lazy-loaded to avoid native binding issues in unit tests
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 * Note: bcrypt is lazy-loaded to avoid native binding issues in unit tests
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}

/**
 * Mock user payload (from JWT strategy)
 */
export interface MockUser {
  userId: string;
  email: string;
  role: string;
}

/**
 * Create a mock user payload for testing
 */
export function createMockUser(
  userKey: keyof typeof TEST_USERS = 'user1'
): MockUser {
  const user = TEST_USERS[userKey];
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

/**
 * Create a mock admin user payload
 */
export function createMockAdminUser(): MockUser {
  return createMockUser('admin');
}

/**
 * Decode a JWT token without verification (for testing)
 */
export function decodeToken(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const payload = Buffer.from(parts[1], 'base64').toString('utf8');
  return JSON.parse(payload);
}

