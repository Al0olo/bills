import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookSignatureGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Receive payment webhook',
    description:
      'Endpoint for receiving payment status updates from Payment Service',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    description: 'HMAC SHA-256 signature of the request body',
    required: true,
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key to prevent duplicate webhook processing',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        received: { type: 'boolean' },
        processedAt: { type: 'string', format: 'date-time' },
        subscriptionId: { type: 'string' },
        newStatus: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook signature',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found',
    type: ErrorResponseDto,
  })
  async receivePaymentWebhook(@Body() webhookDto: PaymentWebhookDto) {
    return this.webhooksService.processPaymentWebhook(webhookDto);
  }
}

