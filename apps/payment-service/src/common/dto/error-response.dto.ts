import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationError {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  error!: string;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty()
  path!: string;

  @ApiPropertyOptional()
  requestId?: string;

  @ApiPropertyOptional({ type: [ValidationError] })
  errors?: ValidationError[];

  @ApiPropertyOptional()
  details?: any;
}


