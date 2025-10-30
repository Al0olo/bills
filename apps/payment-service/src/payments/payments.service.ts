import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookClientService } from '../webhook/webhook-client.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentResponseDto, PaymentStatus } from './dto/payment-response.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly successRate: number;
  private readonly processingDelayMs: number;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookClient: WebhookClientService,
    private readonly configService: ConfigService
  ) {
    this.successRate = this.configService.get<number>('simulation.successRate') || 80;
    this.processingDelayMs = this.configService.get<number>('simulation.processingDelayMs') || 2000;
    this.minDelayMs = this.configService.get<number>('simulation.minDelayMs') || 1000;
    this.maxDelayMs = this.configService.get<number>('simulation.maxDelayMs') || 5000;
  }

  /**
   * Initiate a payment transaction
   */
  async initiatePayment(
    initiatePaymentDto: InitiatePaymentDto
  ): Promise<PaymentResponseDto> {
    const { externalReference, amount, currency, metadata } = initiatePaymentDto;

    this.logger.log(`Initiating payment for reference: ${externalReference}`);

    // Create payment transaction
    const payment = await this.prisma.executeTransaction(async (tx) => {
      return await tx.paymentTransaction.create({
        data: {
          externalReference,
          amount,
          currency,
          status: 'PENDING',
          metadata: metadata || {},
        },
      });
    });

    // Process payment asynchronously
    this.processPaymentAsync(payment.id).catch((error) => {
      this.logger.error(`Failed to process payment ${payment.id}: ${error.message}`);
    });

    return this.mapToResponse(payment);
  }

  /**
   * Get payment by ID
   */
  async getPayment(id: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException({
        message: 'Payment not found',
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    return this.mapToResponse(payment);
  }

  /**
   * Get payment by external reference
   */
  async getPaymentByReference(reference: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { externalReference: reference },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new NotFoundException({
        message: 'Payment not found for reference',
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    return this.mapToResponse(payment);
  }

  /**
   * Process payment asynchronously with simulation
   */
  private async processPaymentAsync(paymentId: string): Promise<void> {
    // Random delay to simulate processing time
    const delay = Math.floor(
      Math.random() * (this.maxDelayMs - this.minDelayMs) + this.minDelayMs
    );
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Update status to PROCESSING
    await this.prisma.paymentTransaction.update({
      where: { id: paymentId },
      data: { status: 'PROCESSING' },
    });

    this.logger.log(`Processing payment ${paymentId}...`);

    // Additional processing delay
    await new Promise((resolve) => setTimeout(resolve, this.processingDelayMs));

    // Simulate success/failure based on success rate
    const isSuccess = Math.random() * 100 < this.successRate;

    await this.prisma.executeTransaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      const updatedPayment = await tx.paymentTransaction.update({
        where: { id: paymentId },
        data: {
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          failureReason: isSuccess ? null : 'Simulated payment failure',
          processedAt: new Date(),
        },
      });

      this.logger.log(
        `Payment ${paymentId} ${isSuccess ? 'succeeded' : 'failed'}`
      );

      // Send webhook to subscription service
      const webhookPayload = {
        eventType: isSuccess
          ? ('payment.completed' as const)
          : ('payment.failed' as const),
        paymentId: updatedPayment.id,
        externalReference: updatedPayment.externalReference,
        status: isSuccess ? ('success' as const) : ('failed' as const),
        amount: parseFloat(updatedPayment.amount.toString()),
        currency: updatedPayment.currency,
        timestamp: new Date().toISOString(),
        metadata: updatedPayment.metadata as Record<string, any>,
      };

      const idempotencyKey = `webhook_${paymentId}_${Date.now()}`;

      // Send webhook (fire and forget with retry)
      this.webhookClient
        .sendWebhook(webhookPayload, idempotencyKey)
        .then((success) => {
          if (success) {
            this.logger.log(`Webhook sent for payment ${paymentId}`);
          } else {
            this.logger.error(`Webhook failed for payment ${paymentId}`);
          }
        })
        .catch((error) => {
          this.logger.error(
            `Webhook error for payment ${paymentId}: ${error.message}`
          );
        });
    });
  }

  /**
   * Map database model to response DTO
   */
  private mapToResponse(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      externalReference: payment.externalReference,
      amount: parseFloat(payment.amount.toString()),
      currency: payment.currency,
      status: payment.status as PaymentStatus,
      failureReason: payment.failureReason,
      metadata: payment.metadata as Record<string, any>,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      processedAt: payment.processedAt,
    };
  }
}


