import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty, IsOptional, IsObject, Min, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'External reference (e.g., subscription ID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  externalReference!: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 29.99,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { userId: '123', planName: 'Pro Plan' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}


