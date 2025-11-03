import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process payment webhook
   */
  async processPaymentWebhook(webhookDto: PaymentWebhookDto): Promise<{
    received: boolean;
    processedAt: Date;
    subscriptionId: string;
    newStatus: string;
  }> {
    const { paymentId, externalReference, status } = webhookDto;

    this.logger.log(
      `Processing payment webhook: ${paymentId} for subscription: ${externalReference}`
    );

    return await this.prisma.executeTransaction(async (tx) => {
      // Find subscription by payment gateway ID
      const subscription = await tx.subscription.findFirst({
        where: {
          id: externalReference,
        },
      });

      if (!subscription) {
        this.logger.error(
          `Subscription not found for payment reference: ${externalReference}`
        );
        throw new NotFoundException({
          message: 'Subscription not found for payment reference',
          code: 'SUBSCRIPTION_NOT_FOUND',
          details: {
            externalReference,
          },
        });
      }

      // Determine new subscription status based on payment status
      const newStatus = status === 'success' ? 'ACTIVE' : 'CANCELLED';

      // Update subscription status
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: newStatus,
          paymentGatewayId: paymentId,
        },
      });

      // Update or create payment record
      const paymentRecord = await tx.paymentRecord.findFirst({
        where: {
          subscriptionId: subscription.id,
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (paymentRecord) {
        // Update existing payment record
        await tx.paymentRecord.update({
          where: { id: paymentRecord.id },
          data: {
            status: status === 'success' ? 'SUCCESS' : 'FAILED',
            paymentGatewayId: paymentId,
            failureReason:
              status === 'failed' ? webhookDto.failureReason || 'Payment processing failed' : null,
          },
        });
      } else {
        // Create new payment record if none exists
        await tx.paymentRecord.create({
          data: {
            subscriptionId: subscription.id,
            amount: webhookDto.amount,
            currency: webhookDto.currency,
            status: status === 'success' ? 'SUCCESS' : 'FAILED',
            paymentGatewayId: paymentId,
            failureReason: status === 'failed' ? webhookDto.failureReason || 'Payment processing failed' : null,
          },
        });
      }

      this.logger.log(
        `Subscription ${subscription.id} updated to status: ${newStatus}`
      );

      return {
        received: true,
        processedAt: new Date(),
        subscriptionId: subscription.id,
        newStatus,
      };
    });
  }
}

