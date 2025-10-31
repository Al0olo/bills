import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { createTestPlan } from '../test-utils';

describe('PlansService', () => {
  let service: PlansService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPlan = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Basic Plan',
    description: 'Basic subscription plan',
    price: 9.99,
    billingCycle: 'MONTHLY' as const,
    features: ['Feature 1', 'Feature 2'],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      plan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createPlanDto: CreatePlanDto = {
      name: 'Premium Plan',
      description: 'Premium subscription plan',
      price: 29.99,
      billingCycle: 'MONTHLY',
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
    };

    it('should successfully create a new plan', async () => {
      prismaService.plan.findUnique.mockResolvedValue(null);
      prismaService.plan.create.mockResolvedValue(mockPlan);

      const result = await service.create(createPlanDto);

      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { name: createPlanDto.name },
      });
      expect(prismaService.plan.create).toHaveBeenCalledWith({
        data: {
          ...createPlanDto,
          features: createPlanDto.features,
        },
      });
      expect(result).toEqual({
        id: mockPlan.id,
        name: mockPlan.name,
        description: mockPlan.description,
        price: mockPlan.price,
        billingCycle: mockPlan.billingCycle,
        features: mockPlan.features,
        isActive: mockPlan.isActive,
        createdAt: mockPlan.createdAt,
        updatedAt: mockPlan.updatedAt,
      });
    });

    it('should create plan with empty features if not provided', async () => {
      const dtoWithoutFeatures: CreatePlanDto = {
        name: 'Basic Plan',
        description: 'Basic plan',
        price: 9.99,
        billingCycle: 'MONTHLY',
      };

      prismaService.plan.findUnique.mockResolvedValue(null);
      prismaService.plan.create.mockResolvedValue({
        ...mockPlan,
        features: [],
      });

      await service.create(dtoWithoutFeatures);

      expect(prismaService.plan.create).toHaveBeenCalledWith({
        data: {
          ...dtoWithoutFeatures,
          features: [],
        },
      });
    });

    it('should throw ConflictException if plan name already exists', async () => {
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);

      await expect(service.create(createPlanDto)).rejects.toThrow(
        ConflictException
      );
      await expect(service.create(createPlanDto)).rejects.toThrow(
        'Plan with this name already exists'
      );

      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { name: createPlanDto.name },
      });
      expect(prismaService.plan.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException with correct error code', async () => {
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);

      try {
        await service.create(createPlanDto);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as any).response.code).toBe('PLAN_EXISTS');
      }
    });

    it('should handle database errors during creation', async () => {
      prismaService.plan.findUnique.mockResolvedValue(null);
      prismaService.plan.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.create(createPlanDto)).rejects.toThrow(
        'Database error'
      );
    });

    it('should create plan with YEARLY billing cycle', async () => {
      const yearlyPlanDto: CreatePlanDto = {
        ...createPlanDto,
        billingCycle: 'YEARLY',
        price: 299.99,
      };

      prismaService.plan.findUnique.mockResolvedValue(null);
      prismaService.plan.create.mockResolvedValue({
        ...mockPlan,
        billingCycle: 'YEARLY',
        price: 299.99,
      });

      const result = await service.create(yearlyPlanDto);

      expect(result.billingCycle).toBe('YEARLY');
      expect(result.price).toBe(299.99);
    });
  });

  describe('findAll', () => {
    const mockPlans = [
      { ...mockPlan, id: '1', name: 'Basic', price: 9.99 },
      { ...mockPlan, id: '2', name: 'Pro', price: 19.99 },
      { ...mockPlan, id: '3', name: 'Premium', price: 29.99 },
    ];

    it('should return all plans without filter', async () => {
      prismaService.plan.findMany.mockResolvedValue(mockPlans);

      const result = await service.findAll();

      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: {
          price: 'asc',
        },
      });
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Basic');
    });

    it('should filter plans by isActive=true', async () => {
      const activePlans = mockPlans.filter((p) => p.isActive);
      prismaService.plan.findMany.mockResolvedValue(activePlans);

      const result = await service.findAll(true);

      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: {
          price: 'asc',
        },
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((p) => p.isActive)).toBe(true);
    });

    it('should filter plans by isActive=false', async () => {
      const inactivePlan = { ...mockPlan, isActive: false };
      prismaService.plan.findMany.mockResolvedValue([inactivePlan]);

      const result = await service.findAll(false);

      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: false },
        orderBy: {
          price: 'asc',
        },
      });
      expect(result[0].isActive).toBe(false);
    });

    it('should return empty array if no plans exist', async () => {
      prismaService.plan.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should order plans by price ascending', async () => {
      prismaService.plan.findMany.mockResolvedValue(mockPlans);

      await service.findAll();

      expect(prismaService.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'asc' },
        })
      );
    });

    it('should correctly map decimal prices to float', async () => {
      const planWithDecimal = {
        ...mockPlan,
        price: { toString: () => '9.99' }, // Prisma Decimal type
      };
      prismaService.plan.findMany.mockResolvedValue([planWithDecimal as any]);

      const result = await service.findAll();

      expect(result[0].price).toBe(9.99);
      expect(typeof result[0].price).toBe('number');
    });
  });

  describe('findOne', () => {
    it('should return a plan by ID', async () => {
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.findOne(mockPlan.id);

      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { id: mockPlan.id },
      });
      expect(result).toEqual({
        id: mockPlan.id,
        name: mockPlan.name,
        description: mockPlan.description,
        price: mockPlan.price,
        billingCycle: mockPlan.billingCycle,
        features: mockPlan.features,
        isActive: mockPlan.isActive,
        createdAt: mockPlan.createdAt,
        updatedAt: mockPlan.updatedAt,
      });
    });

    it('should throw NotFoundException if plan does not exist', async () => {
      prismaService.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent-id')
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('non-existent-id')
      ).rejects.toThrow('Plan not found');
    });

    it('should throw NotFoundException with correct error code', async () => {
      prismaService.plan.findUnique.mockResolvedValue(null);

      try {
        await service.findOne('non-existent-id');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as any).response.code).toBe('PLAN_NOT_FOUND');
      }
    });

    it('should handle database errors', async () => {
      prismaService.plan.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.findOne(mockPlan.id)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('update', () => {
    const updatePlanDto: UpdatePlanDto = {
      name: 'Updated Plan',
      price: 39.99,
    };

    it('should successfully update a plan', async () => {
      const updatedPlan = { ...mockPlan, ...updatePlanDto };
      
      prismaService.plan.findUnique.mockResolvedValueOnce(mockPlan);
      prismaService.plan.findUnique.mockResolvedValueOnce(null); // Name check
      prismaService.plan.update.mockResolvedValue(updatedPlan);

      const result = await service.update(mockPlan.id, updatePlanDto);

      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { id: mockPlan.id },
      });
      expect(prismaService.plan.update).toHaveBeenCalledWith({
        where: { id: mockPlan.id },
        data: updatePlanDto,
      });
      expect(result.name).toBe(updatePlanDto.name);
      expect(result.price).toBe(updatePlanDto.price);
    });

    it('should throw NotFoundException if plan does not exist', async () => {
      prismaService.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updatePlanDto)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update('non-existent-id', updatePlanDto)
      ).rejects.toThrow('Plan not found');
    });

    it('should throw ConflictException if new name already exists', async () => {
      const conflictingPlan = { ...mockPlan, id: 'different-id' };
      
      prismaService.plan.findUnique
        .mockResolvedValueOnce(mockPlan) // Existing plan check
        .mockResolvedValueOnce(conflictingPlan); // Name conflict check

      await expect(
        service.update(mockPlan.id, updatePlanDto)
      ).rejects.toThrow(ConflictException);
      await expect(
        service.update(mockPlan.id, updatePlanDto)
      ).rejects.toThrow('Plan with this name already exists');
    });

    it('should allow updating without changing name', async () => {
      const dtoWithoutName: UpdatePlanDto = { price: 49.99 };
      const updatedPlan = { ...mockPlan, price: 49.99 };
      
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.plan.update.mockResolvedValue(updatedPlan);

      const result = await service.update(mockPlan.id, dtoWithoutName);

      expect(result.price).toBe(49.99);
      expect(result.name).toBe(mockPlan.name);
    });

    it('should allow updating name to the same value', async () => {
      const dtoSameName: UpdatePlanDto = { name: mockPlan.name, price: 49.99 };
      const updatedPlan = { ...mockPlan, price: 49.99 };
      
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.plan.update.mockResolvedValue(updatedPlan);

      const result = await service.update(mockPlan.id, dtoSameName);

      expect(result.name).toBe(mockPlan.name);
      // Should not check for name conflict since it's the same name
      expect(prismaService.plan.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should update plan features', async () => {
      const dtoWithFeatures: UpdatePlanDto = {
        features: ['New Feature 1', 'New Feature 2'],
      };
      const updatedPlan = { ...mockPlan, features: dtoWithFeatures.features };
      
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.plan.update.mockResolvedValue(updatedPlan);

      const result = await service.update(mockPlan.id, dtoWithFeatures);

      expect(result.features).toEqual(dtoWithFeatures.features);
    });

    it('should update billing cycle', async () => {
      const dtoWithCycle: UpdatePlanDto = { billingCycle: 'YEARLY' };
      const updatedPlan = { ...mockPlan, billingCycle: 'YEARLY' as const };
      
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.plan.update.mockResolvedValue(updatedPlan);

      const result = await service.update(mockPlan.id, dtoWithCycle);

      expect(result.billingCycle).toBe('YEARLY');
    });
  });

  describe('deactivate', () => {
    it('should successfully deactivate a plan', async () => {
      const deactivatedPlan = { ...mockPlan, isActive: false };
      prismaService.plan.update.mockResolvedValue(deactivatedPlan);

      const result = await service.deactivate(mockPlan.id);

      expect(prismaService.plan.update).toHaveBeenCalledWith({
        where: { id: mockPlan.id },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
      expect(result.id).toBe(mockPlan.id);
    });

    it('should handle non-existent plan gracefully', async () => {
      prismaService.plan.update.mockRejectedValue(
        new Error('Record to update not found')
      );

      await expect(service.deactivate('non-existent-id')).rejects.toThrow();
    });

    it('should preserve all other plan properties', async () => {
      const deactivatedPlan = { ...mockPlan, isActive: false };
      prismaService.plan.update.mockResolvedValue(deactivatedPlan);

      const result = await service.deactivate(mockPlan.id);

      expect(result.name).toBe(mockPlan.name);
      expect(result.price).toBe(mockPlan.price);
      expect(result.features).toEqual(mockPlan.features);
      expect(result.isActive).toBe(false);
    });
  });

  describe('mapToResponse', () => {
    it('should correctly map plan to response DTO', () => {
      const mapped = (service as any).mapToResponse(mockPlan);

      expect(mapped).toEqual({
        id: mockPlan.id,
        name: mockPlan.name,
        description: mockPlan.description,
        price: mockPlan.price,
        billingCycle: mockPlan.billingCycle,
        features: mockPlan.features,
        isActive: mockPlan.isActive,
        createdAt: mockPlan.createdAt,
        updatedAt: mockPlan.updatedAt,
      });
    });

    it('should convert Prisma Decimal to number', () => {
      const planWithDecimal = {
        ...mockPlan,
        price: { toString: () => '29.99' },
      };

      const mapped = (service as any).mapToResponse(planWithDecimal);

      expect(mapped.price).toBe(29.99);
      expect(typeof mapped.price).toBe('number');
    });

    it('should handle large decimal values', () => {
      const planWithLargePrice = {
        ...mockPlan,
        price: { toString: () => '999.99' },
      };

      const mapped = (service as any).mapToResponse(planWithLargePrice);

      expect(mapped.price).toBe(999.99);
    });

    it('should handle zero price', () => {
      const freePlan = {
        ...mockPlan,
        price: { toString: () => '0' },
      };

      const mapped = (service as any).mapToResponse(freePlan);

      expect(mapped.price).toBe(0);
    });
  });
});

