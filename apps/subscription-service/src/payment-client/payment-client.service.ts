import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';
import {
  InitiatePaymentDto,
  PaymentResponseDto,
} from './dto/initiate-payment.dto';

@Injectable()
export class PaymentClientService {
  private readonly logger = new Logger(PaymentClientService.name);
  private readonly paymentServiceUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.paymentServiceUrl = this.configService.get<string>(
      'payment.serviceUrl'
    )!;
    this.apiKey = this.configService.get<string>('payment.apiKey')!;
  }

  /**
   * Initiate a payment transaction
   */
  async initiatePayment(
    data: InitiatePaymentDto,
    idempotencyKey: string
  ): Promise<PaymentResponseDto> {
    const url = `${this.paymentServiceUrl}/v1/payments/initiate`;

    this.logger.log(
      `Initiating payment for reference: ${data.externalReference}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<PaymentResponseDto>(url, data, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Idempotency-Key': idempotencyKey,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(
                `Payment initiation failed: ${error.message}`,
                error.response?.data
              );
              throw new HttpException(
                error.response?.data || 'Payment service error',
                error.response?.status || 500
              );
            })
          )
      );

      this.logger.log(
        `Payment initiated successfully: ${response.data.id}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to initiate payment: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResponseDto> {
    const url = `${this.paymentServiceUrl}/v1/payments/${paymentId}`;

    this.logger.log(`Getting payment status for: ${paymentId}`);

    try {
      const response = await firstValueFrom(
        this.httpService
          .get<PaymentResponseDto>(url, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(
                `Failed to get payment status: ${error.message}`,
                error.response?.data
              );
              throw new HttpException(
                error.response?.data || 'Payment service error',
                error.response?.status || 500
              );
            })
          )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get payment status: ${error.message}`);
      throw error;
    }
  }
}

