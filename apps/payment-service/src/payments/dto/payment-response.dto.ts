import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  externalReference!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiPropertyOptional()
  failureReason?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  processedAt?: Date;
}

