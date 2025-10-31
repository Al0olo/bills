import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard, IS_PUBLIC_KEY } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: jest.Mocked<ConfigService>;
  let reflector: jest.Mocked<Reflector>;

  const mockApiKey = 'test-api-key-12345';

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'apiKey') {
          return mockApiKey;
        }
        return null;
      }),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new ApiKeyGuard(configService, reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    function createMockContext(
      headers: Record<string, string> = {}
    ): ExecutionContext {
      return {
        switchToHttp: jest.fn(() => ({
          getRequest: () => ({ headers }),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getType: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as any;
    }

    it('should be defined', () => {
      expect(guard.canActivate).toBeDefined();
    });

    it('should allow request with valid API key', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': mockApiKey });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should check for public decorator', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': mockApiKey });

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should allow public routes without API key', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext({});

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if API key is missing', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message when API key missing', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({});

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as any).response.message).toBe('API key is required');
      }
    });

    it('should throw UnauthorizedException with correct error code when API key missing', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({});

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as any).response.code).toBe('API_KEY_REQUIRED');
      }
    });

    it('should throw UnauthorizedException if API key is invalid', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': 'invalid-key' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message when API key invalid', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': 'invalid-key' });

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as any).response.message).toBe('Invalid API key');
      }
    });

    it('should throw UnauthorizedException with correct error code when API key invalid', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': 'invalid-key' });

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as any).response.code).toBe('INVALID_API_KEY');
      }
    });

    it('should read API key from x-api-key header', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': mockApiKey });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should be case-sensitive for API key', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const upperCaseKey = mockApiKey.toUpperCase();
      const context = createMockContext({ 'x-api-key': upperCaseKey });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should not allow API key with extra whitespace', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const keyWithWhitespace = ` ${mockApiKey} `;
      const context = createMockContext({ 'x-api-key': keyWithWhitespace });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should check handler-level public decorator', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext({});

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });

    it('should check class-level public decorator', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext({});

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        expect.any(Array)
      );
    });

    it('should handle empty API key', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': '' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle null API key', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': null as any });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle undefined API key', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': undefined as any });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should allow requests with correct API key and other headers', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({
        'x-api-key': mockApiKey,
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should only check x-api-key header', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({
        'api-key': mockApiKey, // Wrong header name
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle multiple API keys in different headers', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({
        'x-api-key': mockApiKey,
        'api-key': 'wrong-key',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true); // Should use x-api-key
    });
  });

  describe('constructor', () => {
    it('should load API key from configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('apiKey');
    });

    it('should handle missing API key configuration', () => {
      const mockConfigWithNoKey = {
        get: jest.fn(() => undefined),
      } as any;

      const guardWithNoKey = new ApiKeyGuard(mockConfigWithNoKey, reflector);

      expect(guardWithNoKey).toBeDefined();
    });
  });

  describe('security', () => {
    function createMockContext(
      headers: Record<string, string> = {}
    ): ExecutionContext {
      return {
        switchToHttp: jest.fn(() => ({
          getRequest: () => ({ headers }),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getType: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as any;
    }

    it('should not leak API key in error messages', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': 'wrong-key' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const errorMessage = JSON.stringify(error);
        expect(errorMessage).not.toContain(mockApiKey);
      }
    });

    it('should not allow partial API key matches', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const partialKey = mockApiKey.substring(0, mockApiKey.length - 1);
      const context = createMockContext({ 'x-api-key': partialKey });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should not allow API key with additional characters', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const extendedKey = `${mockApiKey}extra`;
      const context = createMockContext({ 'x-api-key': extendedKey });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle special characters in API key', () => {
      const specialKey = 'test-key!@#$%^&*()';
      const mockConfigSpecial = {
        get: jest.fn(() => specialKey),
      } as any;
      const guardSpecial = new ApiKeyGuard(mockConfigSpecial, reflector);

      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': specialKey });

      const result = guardSpecial.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    function createMockContext(
      headers: Record<string, string> = {}
    ): ExecutionContext {
      return {
        switchToHttp: jest.fn(() => ({
          getRequest: () => ({ headers }),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getType: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as any;
    }

    it('should handle very long API keys', () => {
      const longKey = 'a'.repeat(1000);
      const mockConfigLong = {
        get: jest.fn(() => longKey),
      } as any;
      const guardLong = new ApiKeyGuard(mockConfigLong, reflector);

      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': longKey });

      const result = guardLong.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle numeric API keys', () => {
      const numericKey = '123456789';
      const mockConfigNumeric = {
        get: jest.fn(() => numericKey),
      } as any;
      const guardNumeric = new ApiKeyGuard(mockConfigNumeric, reflector);

      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': numericKey });

      const result = guardNumeric.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle unicode characters in API key', () => {
      const unicodeKey = 'test-key-测试-🔑';
      const mockConfigUnicode = {
        get: jest.fn(() => unicodeKey),
      } as any;
      const guardUnicode = new ApiKeyGuard(mockConfigUnicode, reflector);

      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext({ 'x-api-key': unicodeKey });

      const result = guardUnicode.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle request with no headers', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = {
        switchToHttp: jest.fn(() => ({
          getRequest: () => ({ headers: {} }),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});

