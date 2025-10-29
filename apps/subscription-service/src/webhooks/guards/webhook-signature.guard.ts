import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>('webhook.secret')!;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-webhook-signature'] as string;

    if (!signature) {
      this.logger.warn('Webhook signature missing');
      throw new UnauthorizedException({
        message: 'Webhook signature missing',
        code: 'MISSING_SIGNATURE',
      });
    }

    // Generate expected signature
    const payload = JSON.stringify(request.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    // Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException({
        message: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE',
      });
    }

    this.logger.log('Webhook signature verified');
    return true;
  }
}

