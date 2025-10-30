import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

export interface WebhookPayload {
  eventType: 'payment.completed' | 'payment.failed';
  paymentId: string;
  externalReference: string;
  status: 'success' | 'failed';
  amount: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class WebhookClientService {
  private readonly logger = new Logger(WebhookClientService.name);
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.webhookUrl = this.configService.get<string>('webhook.subscriptionServiceUrl')!;
    this.webhookSecret = this.configService.get<string>('webhook.secret')!;
    this.retryAttempts = this.configService.get<number>('webhook.retryAttempts') || 3;
    this.retryDelay = this.configService.get<number>('webhook.retryDelay') || 1000;
  }

  /**
   * Send webhook with retry logic
   */
  async sendWebhook(
    payload: WebhookPayload,
    idempotencyKey: string
  ): Promise<boolean> {
    this.logger.log(
      `Sending webhook for payment ${payload.paymentId} to ${this.webhookUrl}`
    );

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.sendWebhookAttempt(payload, idempotencyKey);
        this.logger.log(
          `Webhook sent successfully for payment ${payload.paymentId}`
        );
        return true;
      } catch (error: any) {
        this.logger.warn(
          `Webhook attempt ${attempt}/${this.retryAttempts} failed: ${error?.message}`
        );

        if (attempt < this.retryAttempts) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      `Failed to send webhook for payment ${payload.paymentId} after ${this.retryAttempts} attempts`
    );
    return false;
  }

  /**
   * Single webhook attempt
   */
  private async sendWebhookAttempt(
    payload: WebhookPayload,
    idempotencyKey: string
  ): Promise<void> {
    // Generate HMAC signature
    const signature = this.generateSignature(payload);

    // Send webhook
    const response = await firstValueFrom(
      this.httpService.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'Idempotency-Key': idempotencyKey,
        },
        timeout: 10000, // 10 seconds
      })
    );

    if (response.status !== 200) {
      throw new Error(`Webhook returned status ${response.status}`);
    }
  }

  /**
   * Generate HMAC SHA-256 signature for webhook payload
   */
  private generateSignature(payload: any): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadString)
      .digest('hex');
  }
}

