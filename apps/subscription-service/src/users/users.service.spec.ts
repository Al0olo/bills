import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, SortOrder } from '../common/dto/pagination.dto';
import { createMockPrismaService } from '../test-utils';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockUsers = [
    mockUser,
    {
      id: 'user-456',
      email: 'user2@example.com',
      name: 'User Two',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'user-789',
      email: 'user3@example.com',
      name: 'User Three',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should successfully get user profile', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

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
      expect(result).toEqual(mockUser);
    });

    it('should not return password hash', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getProfile('non-existent')).rejects.toThrow(
        'User not found'
      );
    });

    it('should handle database errors', async () => {
      (prismaService.user.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getProfile(mockUser.id)).rejects.toThrow(
        'Database error'
      );
    });

    it('should return user with correct fields', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };

    it('should successfully update user profile', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null); // Email not in use
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, updateDto);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: updateDto,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result.name).toBe(updateDto.name);
      expect(result.email).toBe(updateDto.email);
    });

    it('should allow updating name only', async () => {
      const nameOnlyDto: UpdateUserDto = { name: 'New Name' };
      const updatedUser = { ...mockUser, name: 'New Name' };
      
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, nameOnlyDto);

      expect(result.name).toBe('New Name');
      expect(result.email).toBe(mockUser.email);
      // Should not check email conflict if email not being changed
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should allow updating email only', async () => {
      const emailOnlyDto: UpdateUserDto = { email: 'newemail@example.com' };
      const updatedUser = { ...mockUser, email: 'newemail@example.com' };
      
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, emailOnlyDto);

      expect(result.email).toBe('newemail@example.com');
    });

    it('should throw ConflictException if email already in use by another user', async () => {
      const otherUser = { ...mockUser, id: 'different-user-id' };
      
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(otherUser);

      await expect(
        service.updateProfile(mockUser.id, updateDto)
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updateProfile(mockUser.id, updateDto)
      ).rejects.toThrow('Email already in use');

      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException with correct error code', async () => {
      const otherUser = { ...mockUser, id: 'different-user-id' };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(otherUser);

      try {
        await service.updateProfile(mockUser.id, updateDto);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as any).response.code).toBe('EMAIL_IN_USE');
      }
    });

    it('should allow user to keep their own email', async () => {
      const sameEmailDto: UpdateUserDto = {
        email: mockUser.email,
        name: 'Updated Name',
      };
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser); // Same user
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, sameEmailDto);

      expect(result.email).toBe(mockUser.email);
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should handle database errors during update', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.updateProfile(mockUser.id, updateDto)
      ).rejects.toThrow('Database error');
    });

    it('should handle non-existent user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.update as jest.Mock).mockRejectedValue(
        new Error('Record to update not found')
      );

      await expect(
        service.updateProfile('non-existent', updateDto)
      ).rejects.toThrow();
    });

    it('should validate email uniqueness case-insensitively', async () => {
      const dtoWithUppercase: UpdateUserDto = {
        email: 'UPDATED@EXAMPLE.COM',
      };
      
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'UPDATED@EXAMPLE.COM',
      });

      await service.updateProfile(mockUser.id, dtoWithUppercase);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'UPDATED@EXAMPLE.COM' },
      });
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = {
      page: 1,
      limit: 20,
      order: SortOrder.DESC,
    };

    it('should return paginated users without search', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prismaService.user.count as jest.Mock).mockResolvedValue(mockUsers.length);

      const result = await service.findAll(paginationDto);

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
    });

    it('should filter users by search term in email', async () => {
      const searchResults = [mockUsers[1]];
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(searchResults);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(paginationDto, 'user2');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'user2', mode: 'insensitive' } },
              { name: { contains: 'user2', mode: 'insensitive' } },
            ],
          },
        })
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter users by search term in name', async () => {
      const searchResults = [mockUsers[0]];
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(searchResults);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(paginationDto, 'Test User');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'Test User', mode: 'insensitive' } },
              { name: { contains: 'Test User', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should perform case-insensitive search', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([mockUsers[0]]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(paginationDto, 'TEST');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                email: expect.objectContaining({ mode: 'insensitive' }),
              }),
            ]),
          }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      const page2Dto: PaginationDto = { page: 2, limit: 10, order: SortOrder.ASC };
      
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([mockUsers[1]]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(15);

      await service.findAll(page2Dto);

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page - 1) * limit
          take: 10,
        })
      );
    });

    it('should order by createdAt', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prismaService.user.count as jest.Mock).mockResolvedValue(mockUsers.length);

      await service.findAll({ ...paginationDto, order: SortOrder.ASC });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'asc',
          },
        })
      );
    });

    it('should return empty array if no users found', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll(paginationDto);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should calculate pagination metadata correctly', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prismaService.user.count as jest.Mock).mockResolvedValue(45);

      const result = await service.findAll(paginationDto);

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('should not return password hashes in results', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prismaService.user.count as jest.Mock).mockResolvedValue(mockUsers.length);

      const result = await service.findAll(paginationDto);

      result.data.forEach((user) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('password');
      });
    });

    it('should handle empty search term', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prismaService.user.count as jest.Mock).mockResolvedValue(mockUsers.length);

      await service.findAll(paginationDto, '');

      // Empty string should be treated as no search
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  describe('findOne', () => {
    it('should successfully get user by ID', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

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
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw NotFoundException with correct error code', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.findOne('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as any).response.code).toBe('USER_NOT_FOUND');
      }
    });

    it('should not return password hash', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password');
    });

    it('should handle database errors', async () => {
      (prismaService.user.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.findOne(mockUser.id)).rejects.toThrow(
        'Database error'
      );
    });

    it('should return user with all required fields', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('name', mockUser.name);
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent email updates', async () => {
      const updateDto: UpdateUserDto = { email: 'new@example.com' };
      
      // Simulate race condition: email becomes taken between check and update
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.update as jest.Mock).mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(
        service.updateProfile(mockUser.id, updateDto)
      ).rejects.toThrow();
    });

    it('should handle very long user names', async () => {
      const longName = 'A'.repeat(255);
      const updateDto: UpdateUserDto = { name: longName };
      const updatedUser = { ...mockUser, name: longName };
      
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, updateDto);

      expect(result.name).toBe(longName);
    });

    it('should handle special characters in search', async () => {
      const specialSearch = "user@test's.com";
      
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({} as PaginationDto, specialSearch);

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                email: expect.objectContaining({ contains: specialSearch }),
              }),
            ]),
          }),
        })
      );
    });

    it('should handle pagination at boundaries', async () => {
      const lastPageDto: PaginationDto = { page: 3, limit: 20, order: SortOrder.DESC };
      
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([mockUsers[0]]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(41);

      const result = await service.findAll(lastPageDto);

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });
  });
});

