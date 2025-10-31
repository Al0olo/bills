import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import {
  createTestUser,
  MockJwtService,
  MockConfigService,
} from '../test-utils';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: MockJwtService;
  let configService: MockConfigService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed_password',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    jwtService = new MockJwtService();
    configService = new MockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);

    // Setup default config responses
    configService.get.mockImplementation((key: string) => {
      const config: Record<string, any> = {
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.expiresIn': '1h',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      const hashedPassword = 'hashed_Password123!';
      const createdUser = {
        id: mockUser.id,
        email: registerDto.email,
        name: registerDto.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      prismaService.user.create.mockResolvedValue({
        ...createdUser,
        passwordHash: hashedPassword,
        role: 'user',
      });
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await service.register(registerDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: hashedPassword,
          name: registerDto.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual({
        user: createdUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during user creation', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      prismaService.user.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('login', () => {
    const userPayload = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      createdAt: mockUser.createdAt,
      updatedAt: mockUser.updatedAt,
    };

    it('should successfully login a user', async () => {
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        user: userPayload,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });
    });

    it('should generate correct JWT payload', async () => {
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        sub: mockUser.id,
        email: mockUser.email,
      });
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        mockUser.email,
        'correct_password'
      );

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct_password',
        mockUser.passwordHash
      );
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password'
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null if password is incorrect', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        mockUser.email,
        'wrong_password'
      );

      expect(result).toBeNull();
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid_refresh_token';
    const tokenPayload = { sub: mockUser.id, email: mockUser.email };

    it('should successfully refresh tokens', async () => {
      const userWithoutPassword = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      jwtService.verify.mockReturnValue(tokenPayload);
      prismaService.user.findUnique.mockResolvedValue(userWithoutPassword);
      jwtService.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshToken(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual({
        user: userWithoutPassword,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      });
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid_token')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.refreshToken('invalid_token')).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jwtService.verify.mockReturnValue(tokenPayload);
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('extractExpirationTime', () => {
    it('should correctly parse seconds', () => {
      const result = (service as any).extractExpirationTime('30s');
      expect(result).toBe(30);
    });

    it('should correctly parse minutes', () => {
      const result = (service as any).extractExpirationTime('15m');
      expect(result).toBe(900);
    });

    it('should correctly parse hours', () => {
      const result = (service as any).extractExpirationTime('2h');
      expect(result).toBe(7200);
    });

    it('should correctly parse days', () => {
      const result = (service as any).extractExpirationTime('7d');
      expect(result).toBe(604800);
    });

    it('should return default value for invalid format', () => {
      const result = (service as any).extractExpirationTime('invalid');
      expect(result).toBe(3600);
    });

    it('should return default value for empty string', () => {
      const result = (service as any).extractExpirationTime('');
      expect(result).toBe(3600);
    });
  });

  describe('password hashing', () => {
    it('should hash password with correct salt rounds', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = 'hashed_password';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await (service as any).hashPassword(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should compare password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = 'hashed_password';

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await (service as any).comparePassword(password, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });
  });

  describe('token generation', () => {
    it('should generate both access and refresh tokens', async () => {
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await (service as any).generateTokens(
        mockUser.id,
        mockUser.email
      );

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should use correct secrets for tokens', async () => {
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      await (service as any).generateTokens(mockUser.id, mockUser.email);

      expect(jwtService.sign).toHaveBeenNthCalledWith(2, 
        { sub: mockUser.id, email: mockUser.email },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        }
      );
    });
  });
});

