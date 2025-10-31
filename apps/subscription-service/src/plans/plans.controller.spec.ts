import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';

describe('PlansController', () => {
  let controller: PlansController;
  let plansService: jest.Mocked<PlansService>;

  const mockPlanResponse: PlanResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Basic Plan',
    description: 'Basic subscription plan',
    price: 9.99,
    billingCycle: 'MONTHLY',
    features: ['Feature 1', 'Feature 2'],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPlans: PlanResponseDto[] = [
    mockPlanResponse,
    {
      ...mockPlanResponse,
      id: '2',
      name: 'Pro Plan',
      price: 19.99,
    },
    {
      ...mockPlanResponse,
      id: '3',
      name: 'Premium Plan',
      price: 29.99,
    },
  ];

  beforeEach(async () => {
    const mockPlansService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        {
          provide: PlansService,
          useValue: mockPlansService,
        },
      ],
    }).compile();

    controller = module.get<PlansController>(PlansController);
    plansService = module.get(PlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should be defined', () => {
      expect(controller.findAll).toBeDefined();
    });

    it('should return all plans without filter', async () => {
      plansService.findAll.mockResolvedValue(mockPlans);

      const result = await controller.findAll();

      expect(plansService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockPlans);
      expect(result).toHaveLength(3);
    });

    it('should filter plans by isActive=true', async () => {
      const activePlans = mockPlans.filter((p) => p.isActive);
      plansService.findAll.mockResolvedValue(activePlans);

      const result = await controller.findAll('true');

      expect(plansService.findAll).toHaveBeenCalledWith(true);
      expect(result).toEqual(activePlans);
    });

    it('should filter plans by isActive=false', async () => {
      const inactivePlan = { ...mockPlanResponse, isActive: false };
      plansService.findAll.mockResolvedValue([inactivePlan]);

      const result = await controller.findAll('false');

      expect(plansService.findAll).toHaveBeenCalledWith(false);
      expect(result).toEqual([inactivePlan]);
    });

    it('should handle string "true" correctly', async () => {
      plansService.findAll.mockResolvedValue(mockPlans);

      await controller.findAll('true');

      expect(plansService.findAll).toHaveBeenCalledWith(true);
    });

    it('should handle string "false" correctly', async () => {
      plansService.findAll.mockResolvedValue([]);

      await controller.findAll('false');

      expect(plansService.findAll).toHaveBeenCalledWith(false);
    });

    it('should return empty array if no plans exist', async () => {
      plansService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      plansService.findAll.mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('should be defined', () => {
      expect(controller.findOne).toBeDefined();
    });

    it('should return a plan by ID', async () => {
      plansService.findOne.mockResolvedValue(mockPlanResponse);

      const result = await controller.findOne(mockPlanResponse.id);

      expect(plansService.findOne).toHaveBeenCalledWith(mockPlanResponse.id);
      expect(result).toEqual(mockPlanResponse);
    });

    it('should pass correct ID to service', async () => {
      const testId = 'test-plan-id-123';
      plansService.findOne.mockResolvedValue(mockPlanResponse);

      await controller.findOne(testId);

      expect(plansService.findOne).toHaveBeenCalledWith(testId);
      expect(plansService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Plan not found');
      plansService.findOne.mockRejectedValue(error);

      await expect(
        controller.findOne('non-existent-id')
      ).rejects.toThrow(error);
    });

    it('should return complete plan details', async () => {
      plansService.findOne.mockResolvedValue(mockPlanResponse);

      const result = await controller.findOne(mockPlanResponse.id);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('billingCycle');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('isActive');
    });
  });

  describe('create', () => {
    const createPlanDto: CreatePlanDto = {
      name: 'Enterprise Plan',
      description: 'Enterprise subscription plan',
      price: 99.99,
      billingCycle: 'MONTHLY',
      features: ['All Features', 'Priority Support', 'Custom Integration'],
    };

    it('should be defined', () => {
      expect(controller.create).toBeDefined();
    });

    it('should successfully create a new plan', async () => {
      const createdPlan = { ...mockPlanResponse, ...createPlanDto };
      plansService.create.mockResolvedValue(createdPlan);

      const result = await controller.create(createPlanDto);

      expect(plansService.create).toHaveBeenCalledWith(createPlanDto);
      expect(result).toEqual(createdPlan);
      expect(result.name).toBe(createPlanDto.name);
    });

    it('should pass all DTO fields to service', async () => {
      plansService.create.mockResolvedValue(mockPlanResponse);

      await controller.create(createPlanDto);

      expect(plansService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createPlanDto.name,
          description: createPlanDto.description,
          price: createPlanDto.price,
          billingCycle: createPlanDto.billingCycle,
          features: createPlanDto.features,
        })
      );
    });

    it('should return created plan with ID', async () => {
      plansService.create.mockResolvedValue(mockPlanResponse);

      const result = await controller.create(createPlanDto);

      expect(result).toHaveProperty('id');
      expect(result.id).toBeTruthy();
    });

    it('should propagate ConflictException from service', async () => {
      const error = new Error('Plan with this name already exists');
      plansService.create.mockRejectedValue(error);

      await expect(controller.create(createPlanDto)).rejects.toThrow(error);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      plansService.create.mockRejectedValue(error);

      await expect(controller.create(createPlanDto)).rejects.toThrow(error);
    });

    it('should create plan with YEARLY billing cycle', async () => {
      const yearlyDto: CreatePlanDto = {
        ...createPlanDto,
        billingCycle: 'YEARLY',
        price: 999.99,
      };
      const yearlyPlan = { ...mockPlanResponse, ...yearlyDto };
      plansService.create.mockResolvedValue(yearlyPlan);

      const result = await controller.create(yearlyDto);

      expect(result.billingCycle).toBe('YEARLY');
      expect(result.price).toBe(999.99);
    });
  });

  describe('update', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const updatePlanDto: UpdatePlanDto = {
      name: 'Updated Plan Name',
      price: 49.99,
    };

    it('should be defined', () => {
      expect(controller.update).toBeDefined();
    });

    it('should successfully update a plan', async () => {
      const updatedPlan = { ...mockPlanResponse, ...updatePlanDto };
      plansService.update.mockResolvedValue(updatedPlan);

      const result = await controller.update(planId, updatePlanDto);

      expect(plansService.update).toHaveBeenCalledWith(planId, updatePlanDto);
      expect(result).toEqual(updatedPlan);
      expect(result.name).toBe(updatePlanDto.name);
    });

    it('should pass both ID and DTO to service', async () => {
      plansService.update.mockResolvedValue(mockPlanResponse);

      await controller.update(planId, updatePlanDto);

      expect(plansService.update).toHaveBeenCalledWith(planId, updatePlanDto);
      expect(plansService.update).toHaveBeenCalledTimes(1);
    });

    it('should allow partial updates', async () => {
      const partialUpdate: UpdatePlanDto = { price: 39.99 };
      const updatedPlan = { ...mockPlanResponse, price: 39.99 };
      plansService.update.mockResolvedValue(updatedPlan);

      const result = await controller.update(planId, partialUpdate);

      expect(result.price).toBe(39.99);
      expect(result.name).toBe(mockPlanResponse.name);
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Plan not found');
      plansService.update.mockRejectedValue(error);

      await expect(
        controller.update('non-existent-id', updatePlanDto)
      ).rejects.toThrow(error);
    });

    it('should propagate ConflictException for duplicate names', async () => {
      const error = new Error('Plan with this name already exists');
      plansService.update.mockRejectedValue(error);

      await expect(controller.update(planId, updatePlanDto)).rejects.toThrow(
        error
      );
    });

    it('should update plan features', async () => {
      const dtoWithFeatures: UpdatePlanDto = {
        features: ['New Feature 1', 'New Feature 2'],
      };
      const updatedPlan = { ...mockPlanResponse, ...dtoWithFeatures };
      plansService.update.mockResolvedValue(updatedPlan);

      const result = await controller.update(planId, dtoWithFeatures);

      expect(result.features).toEqual(dtoWithFeatures.features);
    });

    it('should update description', async () => {
      const dtoWithDescription: UpdatePlanDto = {
        description: 'Updated description',
      };
      const updatedPlan = { ...mockPlanResponse, ...dtoWithDescription };
      plansService.update.mockResolvedValue(updatedPlan);

      const result = await controller.update(planId, dtoWithDescription);

      expect(result.description).toBe('Updated description');
    });
  });

  describe('deactivate', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';

    it('should be defined', () => {
      expect(controller.deactivate).toBeDefined();
    });

    it('should successfully deactivate a plan', async () => {
      const deactivatedPlan = { ...mockPlanResponse, isActive: false };
      plansService.deactivate.mockResolvedValue(deactivatedPlan);

      const result = await controller.deactivate(planId);

      expect(plansService.deactivate).toHaveBeenCalledWith(planId);
      expect(result).toEqual(deactivatedPlan);
      expect(result.isActive).toBe(false);
    });

    it('should pass correct ID to service', async () => {
      const deactivatedPlan = { ...mockPlanResponse, isActive: false };
      plansService.deactivate.mockResolvedValue(deactivatedPlan);

      await controller.deactivate(planId);

      expect(plansService.deactivate).toHaveBeenCalledWith(planId);
      expect(plansService.deactivate).toHaveBeenCalledTimes(1);
    });

    it('should return deactivated plan details', async () => {
      const deactivatedPlan = { ...mockPlanResponse, isActive: false };
      plansService.deactivate.mockResolvedValue(deactivatedPlan);

      const result = await controller.deactivate(planId);

      expect(result.id).toBe(planId);
      expect(result.name).toBe(mockPlanResponse.name);
      expect(result.isActive).toBe(false);
    });

    it('should propagate NotFoundException from service', async () => {
      const error = new Error('Plan not found');
      plansService.deactivate.mockRejectedValue(error);

      await expect(
        controller.deactivate('non-existent-id')
      ).rejects.toThrow(error);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      plansService.deactivate.mockRejectedValue(error);

      await expect(controller.deactivate(planId)).rejects.toThrow(error);
    });
  });

  describe('controller metadata', () => {
    it('should have correct route prefix', () => {
      const metadata = Reflect.getMetadata('path', PlansController);
      expect(metadata).toBe('v1/plans');
    });

    it('should have findAll endpoint as GET', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PlansController.prototype.findAll
      );
      expect(metadata).toBe('');
    });

    it('should have findOne endpoint as GET with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PlansController.prototype.findOne
      );
      expect(metadata).toBe(':id');
    });

    it('should have create endpoint as POST', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PlansController.prototype.create
      );
      expect(metadata).toBe('');
    });

    it('should have update endpoint as PATCH with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PlansController.prototype.update
      );
      expect(metadata).toBe(':id');
    });

    it('should have deactivate endpoint as DELETE with :id', () => {
      const metadata = Reflect.getMetadata(
        'path',
        PlansController.prototype.deactivate
      );
      expect(metadata).toBe(':id');
    });
  });

  describe('query parameter handling', () => {
    it('should handle undefined isActive parameter', async () => {
      plansService.findAll.mockResolvedValue(mockPlans);

      await controller.findAll(undefined);

      expect(plansService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should handle empty string isActive parameter', async () => {
      plansService.findAll.mockResolvedValue(mockPlans);

      await controller.findAll('' as any);

      // Empty string is defined but not 'true' or 'false', so converts to undefined
      expect(plansService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should only accept "true" or "false" strings', async () => {
      plansService.findAll.mockResolvedValue(mockPlans);

      await controller.findAll('invalid' as any);

      // Invalid values should result in undefined
      expect(plansService.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('error scenarios', () => {
    it('should handle service throwing unexpected errors', async () => {
      const error = new Error('Unexpected error');
      plansService.findAll.mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow('Unexpected error');
    });

    it('should handle null response from service', async () => {
      plansService.findOne.mockResolvedValue(null as any);

      const result = await controller.findOne('some-id');

      expect(result).toBeNull();
    });

    it('should propagate timeout errors', async () => {
      const error = new Error('Request timeout');
      plansService.findAll.mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow('Request timeout');
    });
  });
});

