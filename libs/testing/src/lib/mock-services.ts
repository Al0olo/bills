import { of, throwError } from 'rxjs';
import { jest } from '@jest/globals';

/**
 * Mock JwtService for unit testing
 */
export class MockJwtService {
  sign = jest.fn((payload: any) => `mock.jwt.token.${payload.sub}`);
  verify = jest.fn((token: string) => ({
    sub: 'user-id',
    email: 'test@example.com',
    role: 'user',
  }));
  decode = jest.fn((token: string) => ({
    sub: 'user-id',
    email: 'test@example.com',
    role: 'user',
  }));
}

/**
 * Mock ConfigService for unit testing
 */
export class MockConfigService {
  private config: Record<string, any> = {
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    PAYMENT_SERVICE_URL: 'http://localhost:3001',
    PAYMENT_SERVICE_API_KEY: 'test-api-key',
    WEBHOOK_SECRET: 'test-webhook-secret',
  };

  get = jest.fn((key: string) => this.config[key]);
  
  set(key: string, value: any) {
    this.config[key] = value;
  }
}

/**
 * Mock HttpService (Axios) for unit testing
 */
export class MockHttpService {
  post = jest.fn((url: string, data: any, config?: any) => 
    of({
      data: { id: 'mock-id', status: 'success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
  );

  get = jest.fn((url: string, config?: any) =>
    of({
      data: { id: 'mock-id', status: 'success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
  );

  put = jest.fn();
  patch = jest.fn();
  delete = jest.fn();
}

/**
 * Create mock execution context for guards/interceptors
 */
export function createMockExecutionContext(options: {
  user?: any;
  headers?: Record<string, string>;
  body?: any;
  params?: any;
  query?: any;
} = {}): any {
  const mockRequest = {
    user: options.user || null,
    headers: options.headers || {},
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    method: 'GET',
    url: '/test',
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  return {
    switchToHttp: jest.fn(() => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
      getNext: () => jest.fn(),
    })),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
    getClass: jest.fn(),
    getHandler: jest.fn(),
  };
}

/**
 * Create mock call handler for interceptors
 */
export function createMockCallHandler(returnValue: any = {}): any {
  return {
    handle: jest.fn(() => of(returnValue)),
  };
}

/**
 * Mock HTTP error response
 */
export function mockHttpError(statusCode: number, message: string) {
  return throwError(() => ({
    response: {
      status: statusCode,
      data: { message },
    },
    message,
  }));
}

/**
 * Mock successful HTTP response
 */
export function mockHttpSuccess(data: any, statusCode = 200) {
  return of({
    data,
    status: statusCode,
    statusText: 'OK',
    headers: {},
    config: {},
  });
}

/**
 * Reset all mocks in a service
 */
export function resetMockService(service: any) {
  Object.keys(service).forEach((key) => {
    if (typeof service[key] === 'object' && service[key] !== null) {
      // Handle nested objects like prisma.user, prisma.plan, etc.
      Object.keys(service[key]).forEach((nestedKey) => {
        if (jest.isMockFunction(service[key][nestedKey])) {
          (service[key][nestedKey] as jest.Mock).mockReset();
        }
      });
    } else if (jest.isMockFunction(service[key])) {
      (service[key] as jest.Mock).mockReset();
    }
  });
}

/**
 * Create a mock logger
 */
export class MockLogger {
  log = jest.fn();
  error = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  verbose = jest.fn();
}

/**
 * Mock bcrypt for password testing
 */
export const mockBcrypt = {
  hash: jest.fn(async (password: string) => `hashed_${password}`),
  compare: jest.fn(async (password: string, hash: string) => 
    hash === `hashed_${password}`
  ),
};
