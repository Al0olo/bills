import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new plan
   */
  async create(createPlanDto: CreatePlanDto): Promise<PlanResponseDto> {
    // Check if plan with same name already exists
    const existing = await this.prisma.plan.findUnique({
      where: { name: createPlanDto.name },
    });

    if (existing) {
      throw new ConflictException({
        message: 'Plan with this name already exists',
        code: 'PLAN_EXISTS',
      });
    }

    const plan = await this.prisma.plan.create({
      data: {
        ...createPlanDto,
        features: createPlanDto.features || [],
      },
    });

    this.logger.log(`Plan created: ${plan.name}`);

    return this.mapToResponse(plan);
  }

  /**
   * Get all plans with optional filters
   */
  async findAll(isActive?: boolean): Promise<PlanResponseDto[]> {
    const where = isActive !== undefined ? { isActive } : {};

    const plans = await this.prisma.plan.findMany({
      where,
      orderBy: {
        price: 'asc',
      },
    });

    return plans.map((plan) => this.mapToResponse(plan));
  }

  /**
   * Get plan by ID
   */
  async findOne(id: string): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException({
        message: 'Plan not found',
        code: 'PLAN_NOT_FOUND',
      });
    }

    return this.mapToResponse(plan);
  }

  /**
   * Update a plan
   */
  async update(
    id: string,
    updatePlanDto: UpdatePlanDto
  ): Promise<PlanResponseDto> {
    // Check if plan exists
    const existing = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Plan not found',
        code: 'PLAN_NOT_FOUND',
      });
    }

    // Check if new name conflicts with another plan
    if (updatePlanDto.name && updatePlanDto.name !== existing.name) {
      const nameConflict = await this.prisma.plan.findUnique({
        where: { name: updatePlanDto.name },
      });

      if (nameConflict) {
        throw new ConflictException({
          message: 'Plan with this name already exists',
          code: 'PLAN_EXISTS',
        });
      }
    }

    const plan = await this.prisma.plan.update({
      where: { id },
      data: updatePlanDto,
    });

    this.logger.log(`Plan updated: ${plan.name}`);

    return this.mapToResponse(plan);
  }

  /**
   * Deactivate a plan (soft delete)
   */
  async deactivate(id: string): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Plan deactivated: ${plan.name}`);

    return this.mapToResponse(plan);
  }

  /**
   * Map database model to response DTO
   */
  private mapToResponse(plan: any): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: parseFloat(plan.price.toString()),
      billingCycle: plan.billingCycle,
      features: plan.features,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}

