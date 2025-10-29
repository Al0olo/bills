import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class DowngradeSubscriptionDto {
  @ApiProperty({
    description: 'ID of the new plan (must be lower tier)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsNotEmpty()
  newPlanId!: string;
}

