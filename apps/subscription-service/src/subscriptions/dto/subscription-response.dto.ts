import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanResponseDto } from '../../plans/dto/plan-response.dto';

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class PaymentRecordDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  paymentGatewayId!: string;

  @ApiPropertyOptional()
  failureReason?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  planId!: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiProperty()
  startDate!: Date;

  @ApiPropertyOptional()
  endDate!: Date | null;

  @ApiPropertyOptional()
  paymentGatewayId!: string | null;

  @ApiPropertyOptional()
  previousPlanId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: PlanResponseDto })
  plan!: PlanResponseDto;

  @ApiPropertyOptional({ type: PlanResponseDto })
  previousPlan?: PlanResponseDto | null;

  @ApiPropertyOptional({ type: [PaymentRecordDto] })
  paymentRecords?: PaymentRecordDto[];
}

export class UpgradeResponseDto extends SubscriptionResponseDto {
  @ApiPropertyOptional()
  proratedAmount?: number;
}

export class DowngradeResponseDto extends SubscriptionResponseDto {
  @ApiPropertyOptional()
  effectiveDate?: Date;

  @ApiPropertyOptional()
  note?: string;
}

