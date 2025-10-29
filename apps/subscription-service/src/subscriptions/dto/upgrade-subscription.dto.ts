import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class UpgradeSubscriptionDto {
  @ApiProperty({
    description: 'ID of the new plan (must be higher tier)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  @IsNotEmpty()
  newPlanId!: string;
}

