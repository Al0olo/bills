import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@ApiTags('Payments')
@ApiHeader({
  name: 'X-API-Key',
  description: 'API key for authentication',
  required: true,
})
@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Initiate payment',
    description:
      'Initiate a new payment transaction. Payment will be processed asynchronously and a webhook will be sent to the subscription service.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key to prevent duplicate payment processing',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API key',
    type: ErrorResponseDto,
  })
  async initiatePayment(
    @Body() initiatePaymentDto: InitiatePaymentDto
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.initiatePayment(initiatePaymentDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Retrieve payment details by payment ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
    type: ErrorResponseDto,
  })
  async getPayment(@Param('id') id: string): Promise<PaymentResponseDto> {
    return this.paymentsService.getPayment(id);
  }

  @Get('reference/:reference')
  @ApiOperation({
    summary: 'Get payment by external reference',
    description: 'Retrieve payment details by external reference (e.g., subscription ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
    type: ErrorResponseDto,
  })
  async getPaymentByReference(
    @Param('reference') reference: string
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPaymentByReference(reference);
  }
}

