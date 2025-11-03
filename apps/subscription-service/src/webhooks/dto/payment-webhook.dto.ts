import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsObject, IsOptional } from 'class-validator';

export enum WebhookEventType {
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
}

export class PaymentWebhookDto {
  @ApiProperty({ enum: WebhookEventType })
  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  eventType!: WebhookEventType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  externalReference!: string;

  @ApiProperty({ enum: ['success', 'failed'] })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsString()
  currency!: string;

  @ApiProperty()
  @IsString()
  timestamp!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  failureReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

