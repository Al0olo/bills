import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationDto, SortOrder } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockUserResponse: UserResponseDto = {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockUsers: UserResponseDto[] = [
    mockUserResponse,
    {
      id: 'user-456',
      email: 'user2@example.com',
      name: 'User Two',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(async () => {
    const mockUsersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const mockPrismaService = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          key: 'test-key',
          response: {},
          expiresAt: new Date(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        IdempotencyInterceptor,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should be defined', () => {
      expect(controller.getProfile).toBeDefined();
    });

    it('should return current user profile', async () => {
      usersService.getProfile.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(mockUser);

      expect(usersService.getProfile).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUserResponse);
    });

    it('should extract user ID from authenticated user', async () => {
      usersService.getProfile.mockResolvedValue(mockUserResponse);

      await controller.getProfile(mockUser);

      expect(usersService.getProfile).toHaveBeenCalledWith(mockUser.id);
      expect(usersService.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('User not found');
      usersService.getProfile.mockRejectedValue(error);

      await expect(controller.getProfile(mockUser)).rejects.toThrow(error);
    });

    it('should return user without password', async () => {
      usersService.getProfile.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(mockUser);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password');
    });

    it('should handle different user IDs correctly', async () => {
      const differentUser = { ...mockUser, id: 'different-id' };
      usersService.getProfile.mockResolvedValue({
        ...mockUserResponse,
        id: 'different-id',
      });

      await controller.getProfile(differentUser);

      expect(usersService.getProfile).toHaveBeenCalledWith('different-id');
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };

    it('should be defined', () => {
      expect(controller.updateProfile).toBeDefined();
    });

    it('should successfully update user profile', async () => {
      const updatedUser = { ...mockUserResponse, ...updateDto };
      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        updateDto
      );
      expect(result).toEqual(updatedUser);
      expect(result.name).toBe(updateDto.name);
      expect(result.email).toBe(updateDto.email);
    });

    it('should pass user ID and update DTO to service', async () => {
      usersService.updateProfile.mockResolvedValue(mockUserResponse);

      await controller.updateProfile(mockUser, updateDto);

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        updateDto
      );
    });

    it('should allow partial updates - name only', async () => {
      const nameOnlyDto: UpdateUserDto = { name: 'New Name' };
      const updatedUser = { ...mockUserResponse, name: 'New Name' };
      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, nameOnlyDto);

      expect(result.name).toBe('New Name');
      expect(result.email).toBe(mockUserResponse.email);
    });

    it('should allow partial updates - email only', async () => {
      const emailOnlyDto: UpdateUserDto = { email: 'newemail@example.com' };
      const updatedUser = { ...mockUserResponse, email: 'newemail@example.com' };
      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, emailOnlyDto);

      expect(result.email).toBe('newemail@example.com');
      expect(result.name).toBe(mockUserResponse.name);
    });

    it('should propagate ConflictException from service', async () => {
      const error = new Error('Email already in use');
      usersService.updateProfile.mockRejectedValue(error);

      await expect(
        controller.updateProfile(mockUser, updateDto)
      ).rejects.toThrow(error);
    });

    it('should propagate validation errors', async () => {
      const error = new Error('Validation failed');
      usersService.updateProfile.mockRejectedValue(error);

      await expect(
        controller.updateProfile(mockUser, updateDto)
      ).rejects.toThrow(error);
    });

    it('should return updated user with new timestamp', async () => {
      const updatedUser = {
        ...mockUserResponse,
        ...updateDto,
        updatedAt: new Date(),
      };
      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(result.updatedAt).toBeDefined();
      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
        mockUserResponse.updatedAt.getTime()
      );
    });

    it('should handle empty update DTO', async () => {
      const emptyDto: UpdateUserDto = {};
      usersService.updateProfile.mockResolvedValue(mockUserResponse);

      const result = await controller.updateProfile(mockUser, emptyDto);

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        emptyDto
      );
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = {
      page: 1,
      limit: 20,
      order: SortOrder.DESC,
    };

    const mockPaginatedResponse = {
      data: mockUsers,
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('should be defined', () => {
      expect(controller.findAll).toBeDefined();
    });

    it('should return paginated users without search', async () => {
      usersService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll(paginationDto);

      expect(usersService.findAll).toHaveBeenCalledWith(
        paginationDto,
        undefined
      );
      expect(result).toEqual(mockPaginatedResponse);
      expect(result.data).toHaveLength(2);
    });

    it('should filter users by search term', async () => {
      const searchResponse = {
        ...mockPaginatedResponse,
        data: [mockUsers[0]],
        meta: { ...mockPaginatedResponse.meta, total: 1 },
      };
      usersService.findAll.mockResolvedValue(searchResponse);

      const result = await controller.findAll(paginationDto, 'test');

      expect(usersService.findAll).toHaveBeenCalledWith(paginationDto, 'test');
      expect(result.data).toHaveLength(1);
    });

    it('should pass pagination parameters correctly', async () => {
      const customPagination: PaginationDto = {
        page: 2,
        limit: 10,
        order: SortOrder.ASC,
      };
      usersService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(customPagination, 'search');

      expect(usersService.findAll).toHaveBeenCalledWith(
        customPagination,
        'search'
      );
    });

    it('should return empty array if no users found', async () => {
      const emptyResponse = {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      usersService.findAll.mockResolvedValue(emptyResponse);

      const result = await controller.findAll(paginationDto);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should handle search with special characters', async () => {
      const specialSearch = 'test@example.com';
      usersService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(paginationDto, specialSearch);

      expect(usersService.findAll).toHaveBeenCalledWith(
        paginationDto,
        specialSearch
      );
    });

    it('should handle undefined search parameter', async () => {
      usersService.findAll.mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(paginationDto, undefined);

      expect(usersService.findAll).toHaveBeenCalledWith(
        paginationDto,
        undefined
      );
    });

    it('should include pagination metadata in response', async () => {
      usersService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll(paginationDto);

      expect(result.meta).toBeDefined();
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('totalPages');
      expect(result.meta).toHaveProperty('hasNextPage');
      expect(result.meta).toHaveProperty('hasPreviousPage');
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      usersService.findAll.mockRejectedValue(error);

      await expect(controller.findAll(paginationDto)).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('should be defined', () => {
      expect(controller.findOne).toBeDefined();
    });

    it('should return user by ID', async () => {
      usersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.findOne(mockUser.id);

      expect(usersService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUserResponse);
    });

    it('should pass correct user ID to service', async () => {
      const testId = 'test-user-id-123';
      usersService.findOne.mockResolvedValue(mockUserResponse);

      await controller.findOne(testId);

      expect(usersService.findOne).toHaveBeenCalledWith(testId);
      expect(usersService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('User not found');
      usersService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('non-existent')).rejects.toThrow(error);
    });

    it('should return complete user details', async () => {
      usersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.findOne(mockUser.id);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should not return password in response', async () => {
      usersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.findOne(mockUser.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      usersService.findOne.mockRejectedValue(error);

      await expect(controller.findOne(mockUser.id)).rejects.toThrow(error);
    });
  });

  describe('controller metadata', () => {
    it('should have correct route prefix', () => {
      const metadata = Reflect.getMetadata('path', UsersController);
      expect(metadata).toBe('v1/users');
    });

    it('should have getProfile endpoint as GET me', () => {
      const metadata = Reflect.getMetadata(
        'path',
        UsersController.prototype.getProfile
      );
      expect(metadata).toBe('me');
    });

    it('should have updateProfile endpoint as PATCH me', () => {
      const metadata = Reflect.getMetadata(
        'path',
        UsersController.prototype.updateProfile
      );
      expect(metadata).toBe('me');
    });

    it('should have findAll endpoint as GET', () => {
      const metadata = Reflect.getMetadata(
        'path',
        UsersController.prototype.findAll
      );
      expect(metadata).toBe('/');
    });

    it('should have findOne endpoint as GET with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        UsersController.prototype.findOne
      );
      expect(metadata).toBe(':id');
    });
  });

  describe('authentication', () => {
    it('should use authenticated user in getProfile', async () => {
      usersService.getProfile.mockResolvedValue(mockUserResponse);

      await controller.getProfile(mockUser);

      expect(usersService.getProfile).toHaveBeenCalledWith(mockUser.id);
    });

    it('should use authenticated user in updateProfile', async () => {
      usersService.updateProfile.mockResolvedValue(mockUserResponse);

      await controller.updateProfile(mockUser, { name: 'New Name' });

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should handle missing user object gracefully', async () => {
      usersService.getProfile.mockResolvedValue(mockUserResponse);

      // If user object is malformed but has id
      const malformedUser = { id: 'some-id' } as any;
      await controller.getProfile(malformedUser);

      expect(usersService.getProfile).toHaveBeenCalledWith('some-id');
    });
  });

  describe('query parameter handling', () => {
    it('should handle all pagination parameters', async () => {
      const fullPagination: PaginationDto = {
        page: 3,
        limit: 50,
        order: SortOrder.ASC,
      };
      usersService.findAll.mockResolvedValue({
        data: [],
        meta: {} as any,
      });

      await controller.findAll(fullPagination, 'search');

      expect(usersService.findAll).toHaveBeenCalledWith(
        fullPagination,
        'search'
      );
    });

    it('should handle missing optional parameters', async () => {
      const minimalPagination = {} as PaginationDto;
      usersService.findAll.mockResolvedValue({
        data: [],
        meta: {} as any,
      });

      await controller.findAll(minimalPagination);

      expect(usersService.findAll).toHaveBeenCalledWith(
        minimalPagination,
        undefined
      );
    });

    it('should handle empty string search', async () => {
      usersService.findAll.mockResolvedValue({
        data: [],
        meta: {} as any,
      });

      await controller.findAll({} as PaginationDto, '');

      expect(usersService.findAll).toHaveBeenCalledWith(
        expect.any(Object),
        ''
      );
    });
  });

  describe('error scenarios', () => {
    it('should handle service timeout errors', async () => {
      const error = new Error('Request timeout');
      usersService.findAll.mockRejectedValue(error);

      await expect(
        controller.findAll({} as PaginationDto)
      ).rejects.toThrow('Request timeout');
    });

    it('should handle unexpected service errors', async () => {
      const error = new Error('Unexpected error');
      usersService.getProfile.mockRejectedValue(error);

      await expect(controller.getProfile(mockUser)).rejects.toThrow(
        'Unexpected error'
      );
    });

    it('should handle null response from service', async () => {
      usersService.findOne.mockResolvedValue(null as any);

      const result = await controller.findOne('some-id');

      expect(result).toBeNull();
    });
  });
});

