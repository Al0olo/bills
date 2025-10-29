import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorFieldDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional()
  value?: any;

  @ApiPropertyOptional()
  constraints?: Record<string, any>;
}

export class ErrorResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  error!: string;

  @ApiPropertyOptional({ type: [ErrorFieldDto] })
  errors?: ErrorFieldDto[];

  @ApiProperty()
  timestamp!: string;

  @ApiProperty()
  path!: string;

  @ApiPropertyOptional()
  requestId?: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  details?: Record<string, any>;
}

