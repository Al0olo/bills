import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'Too expensive',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Additional feedback',
    example: 'Great service, but I need to cut costs',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}

