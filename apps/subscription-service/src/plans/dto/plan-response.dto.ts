import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from './create-plan.dto';

export class PlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  price!: number;

  @ApiProperty({ enum: BillingCycle })
  billingCycle!: BillingCycle;

  @ApiPropertyOptional()
  features!: string[] | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

