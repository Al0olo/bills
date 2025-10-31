import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse: AuthResponseDto = {
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should be defined', () => {
      expect(controller.register).toBeDefined();
    });

    it('should successfully register a new user', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
      };

      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should return user data with tokens', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };

      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should propagate service errors', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'Existing User',
      };

      const error = new Error('User already exists');
      authService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(error);
    });
  });

  describe('login', () => {
    it('should be defined', () => {
      expect(controller.login).toBeDefined();
    });

    it('should successfully login a user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const user = {
        id: mockAuthResponse.user.id,
        email: mockAuthResponse.user.email,
        name: mockAuthResponse.user.name,
        createdAt: mockAuthResponse.user.createdAt,
        updatedAt: mockAuthResponse.user.updatedAt,
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto, user);

      expect(authService.login).toHaveBeenCalledWith(user);
      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should return tokens for authenticated user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const user = mockAuthResponse.user;

      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto, user);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should pass user object from guard to service', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const user = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      await controller.login(loginDto, user);

      expect(authService.login).toHaveBeenCalledWith(user);
    });

    it('should propagate authentication errors', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const user = null;
      const error = new Error('Invalid credentials');
      authService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto, user)).rejects.toThrow(error);
    });
  });

  describe('refresh', () => {
    it('should be defined', () => {
      expect(controller.refresh).toBeDefined();
    });

    it('should successfully refresh tokens', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      authService.refreshToken.mockResolvedValue(mockAuthResponse);

      const result = await controller.refresh(refreshTokenDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken
      );
      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should return new access and refresh tokens', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      const newTokenResponse: AuthResponseDto = {
        ...mockAuthResponse,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshToken.mockResolvedValue(newTokenResponse);

      const result = await controller.refresh(refreshTokenDto);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should propagate invalid token errors', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'invalid-refresh-token',
      };

      const error = new Error('Invalid or expired refresh token');
      authService.refreshToken.mockRejectedValue(error);

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(error);
    });

    it('should handle expired tokens', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'expired-refresh-token',
      };

      const error = new Error('Token expired');
      authService.refreshToken.mockRejectedValue(error);

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(error);
      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken
      );
    });

    it('should handle user not found errors', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid-token-for-deleted-user',
      };

      const error = new Error('User not found');
      authService.refreshToken.mockRejectedValue(error);

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(error);
    });
  });

  describe('controller metadata', () => {
    it('should have correct route prefix', () => {
      const metadata = Reflect.getMetadata('path', AuthController);
      expect(metadata).toBe('v1/auth');
    });

    it('should have register endpoint as POST', () => {
      const metadata = Reflect.getMetadata(
        'path',
        AuthController.prototype.register
      );
      expect(metadata).toBe('register');
    });

    it('should have login endpoint as POST', () => {
      const metadata = Reflect.getMetadata(
        'path',
        AuthController.prototype.login
      );
      expect(metadata).toBe('login');
    });

    it('should have refresh endpoint as POST', () => {
      const metadata = Reflect.getMetadata(
        'path',
        AuthController.prototype.refresh
      );
      expect(metadata).toBe('refresh');
    });
  });
});

