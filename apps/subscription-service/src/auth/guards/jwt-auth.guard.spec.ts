import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { createMockExecutionContext } from '../../test-utils';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new JwtAuthGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should be defined', () => {
      expect(guard.canActivate).toBeDefined();
    });

    it('should allow access to public routes', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should check for isPublic metadata on handler and class', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock the parent canActivate to return true
      jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should call super.canActivate for protected routes', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      const superSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(superSpy).toHaveBeenCalledWith(context);
      expect(result).toBe(true);
    });

    it('should bypass JWT validation for public routes', () => {
      const context = createMockExecutionContext({
        headers: {}, // No Authorization header
      });
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should prioritize handler-level public decorator over class-level', () => {
      const context = createMockExecutionContext();
      
      // getAllAndOverride returns true if found on handler
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });

  describe('handleRequest', () => {
    it('should return user if no error and user exists', () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = guard.handleRequest(null, mockUser, null);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if error exists', () => {
      const error = new Error('JWT validation failed');
      const mockUser = { id: '123', email: 'test@example.com' };

      expect(() => guard.handleRequest(error, mockUser, null)).toThrow(
        error
      );
    });

    it('should throw UnauthorizedException if user is null', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined, null)).toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException with correct message when user is missing', () => {
      try {
        guard.handleRequest(null, null, null);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe(
          'Invalid or expired token'
        );
      }
    });

    it('should prioritize error over missing user', () => {
      const error = new Error('Token expired');

      expect(() => guard.handleRequest(error, null, null)).toThrow(error);
    });

    it('should handle info parameter gracefully', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const info = { message: 'Token is valid' };

      const result = guard.handleRequest(null, mockUser, info);

      expect(result).toEqual(mockUser);
    });

    it('should return complete user object with all properties', () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const result = guard.handleRequest(null, mockUser, null);

      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('role');
    });
  });

  describe('integration scenarios', () => {
    it('should work with valid JWT token on protected route', () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const context = createMockExecutionContext({
        user: mockUser,
        headers: {
          authorization: 'Bearer valid-jwt-token',
        },
      });

      reflector.getAllAndOverride.mockReturnValue(false);

      const superSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const canActivateResult = guard.canActivate(context);
      const user = guard.handleRequest(null, mockUser, null);

      expect(canActivateResult).toBe(true);
      expect(user).toEqual(mockUser);
    });

    it('should reject invalid token on protected route', () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      reflector.getAllAndOverride.mockReturnValue(false);

      const superSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockImplementation(() => {
          throw new UnauthorizedException('Invalid token');
        });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should allow access without token on public route', () => {
      const context = createMockExecutionContext({
        headers: {}, // No Authorization header
      });

      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed execution context', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      const superSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(false);

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should handle null reflector metadata gracefully', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(null);

      const superSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      // null is falsy, so should proceed to super.canActivate
      const result = guard.canActivate(context);

      expect(superSpy).toHaveBeenCalled();
    });

    it('should handle undefined reflector metadata gracefully', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const superSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      // undefined is falsy, so should proceed to super.canActivate
      const result = guard.canActivate(context);

      expect(superSpy).toHaveBeenCalled();
    });

    it('should handle empty user object', () => {
      const emptyUser = {};

      // Even empty object is truthy, so should return it
      const result = guard.handleRequest(null, emptyUser as any, null);

      expect(result).toEqual(emptyUser);
    });
  });
});

