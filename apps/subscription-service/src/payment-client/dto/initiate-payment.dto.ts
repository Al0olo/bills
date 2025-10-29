export interface InitiatePaymentDto {
  externalReference: string;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponseDto {
  id: string;
  externalReference: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}
