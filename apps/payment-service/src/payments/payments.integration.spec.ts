import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookClientService } from '../webhook/webhook-client.service';
import {
  generateIdempotencyKey,
} from '@bills/testing';
import {
  cleanupDatabase,
  disconnectTestDb,
} from '../test-utils/test-db.helper';

describe('Payments Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const apiKey = process.env.API_KEY || 'test-api-key';

  // Mock webhook client to avoid external service dependencies
  const mockWebhookClient = {
    sendPaymentWebhook: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WebhookClientService)
      .useValue(mockWebhookClient)
      .compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanupDatabase();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await app.close();
  });

  describe('POST /v1/payments', () => {
    it('should initiate payment successfully', async () => {
      const paymentDto = {
        externalReference: 'sub_test_123',
        amount: 29.99,
        currency: 'USD',
        metadata: {
          userId: 'user_123',
          planName: 'Pro Plan',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(paymentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        externalReference: 'sub_test_123',
        amount: 29.99,
        currency: 'USD',
        status: 'PENDING',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(response.body.metadata).toMatchObject(paymentDto.metadata);

      // Verify payment was created in database
      const payment = await prisma.paymentTransaction.findUnique({
        where: { id: response.body.id },
      });
      expect(payment).toBeTruthy();
      expect(payment?.status).toBe('PENDING');
    });

    it('should reject payment without API key', async () => {
      const paymentDto = {
        externalReference: 'sub_test_456',
        amount: 29.99,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/v1/payments')
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(paymentDto)
        .expect(401);
    });

    it('should reject payment with invalid API key', async () => {
      const paymentDto = {
        externalReference: 'sub_test_789',
        amount: 29.99,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', 'invalid-api-key')
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(paymentDto)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        // missing externalReference
        amount: 29.99,
      };

      await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(invalidDto)
        .expect(400);
    });

    it('should validate amount is positive', async () => {
      const invalidDto = {
        externalReference: 'sub_test_999',
        amount: -10,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(invalidDto)
        .expect(400);
    });

    it('should validate amount has max 2 decimal places', async () => {
      const invalidDto = {
        externalReference: 'sub_test_decimal',
        amount: 29.999,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(invalidDto)
        .expect(400);
    });

    it('should enforce idempotency', async () => {
      const paymentDto = {
        externalReference: 'sub_idempotent_123',
        amount: 29.99,
        currency: 'USD',
      };

      const idempotencyKey = generateIdempotencyKey();

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', idempotencyKey)
        .send(paymentDto)
        .expect(201);

      // Should return same payment
      expect(response1.body.id).toBe(response2.body.id);

      // Verify only one payment was created
      const payments = await prisma.paymentTransaction.findMany({
        where: { externalReference: 'sub_idempotent_123' },
      });
      expect(payments).toHaveLength(1);
    });

    it('should handle different currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP'];

      for (const currency of currencies) {
        const paymentDto = {
          externalReference: `sub_${currency}_123`,
          amount: 29.99,
          currency,
        };

        const response = await request(app.getHttpServer())
          .post('/v1/payments')
          .set('X-API-Key', apiKey)
          .set('Idempotency-Key', generateIdempotencyKey())
          .send(paymentDto)
          .expect(201);

        expect(response.body.currency).toBe(currency);
      }
    });
  });

  describe('GET /v1/payments/:id', () => {
    let testPaymentId: string;

    beforeEach(async () => {
      // Create test payment
      const payment = await prisma.paymentTransaction.create({
        data: {
          externalReference: 'sub_test_123',
          amount: 29.99,
          currency: 'USD',
          status: 'SUCCESS',
          processedAt: new Date(),
          metadata: { test: true },
        },
      });
      testPaymentId = payment.id;
    });

    it('should retrieve payment by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/payments/${testPaymentId}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testPaymentId,
        externalReference: 'sub_test_123',
        amount: 29.99,
        currency: 'USD',
        status: 'SUCCESS',
      });
      expect(response.body).toHaveProperty('processedAt');
      expect(response.body.metadata).toMatchObject({ test: true });
    });

    it('should return 404 for non-existent payment', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440099';

      await request(app.getHttpServer())
        .get(`/v1/payments/${fakeId}`)
        .set('X-API-Key', apiKey)
        .expect(404);
    });

    it('should reject request without API key', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/${testPaymentId}`)
        .expect(401);
    });

    it('should return 400 for invalid uuid', async () => {
      await request(app.getHttpServer())
        .get('/v1/payments/invalid-id')
        .set('X-API-Key', apiKey)
        .expect(400);
    });
  });

  describe('GET /v1/payments/reference/:reference', () => {
    beforeEach(async () => {
      // Create multiple payments with same reference (renewal scenario)
      await prisma.paymentTransaction.createMany({
        data: [
          {
            externalReference: 'sub_reference_123',
            amount: 29.99,
            currency: 'USD',
            status: 'SUCCESS',
            processedAt: new Date('2025-01-01'),
          },
          {
            externalReference: 'sub_reference_123',
            amount: 29.99,
            currency: 'USD',
            status: 'SUCCESS',
            processedAt: new Date('2025-02-01'),
          },
        ],
      });
    });

    it('should retrieve all payments by external reference', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/payments/reference/sub_reference_123')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((p: any) => p.externalReference === 'sub_reference_123')).toBe(true);
    });

    it('should return empty array for non-existent reference', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/payments/reference/non_existent')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should reject request without API key', async () => {
      await request(app.getHttpServer())
        .get('/v1/payments/reference/sub_reference_123')
        .expect(401);
    });
  });

  describe('Payment Processing Simulation', () => {
    it.skip('should eventually process payment asynchronously', async () => {
      const paymentDto = {
        externalReference: 'sub_async_123',
        amount: 29.99,
        currency: 'USD',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(paymentDto)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Initially should be PENDING
      expect(createResponse.body.status).toBe('PENDING');

      // Wait for async processing (simulated payment takes 2-5 seconds)
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Check payment status again
      const checkResponse = await request(app.getHttpServer())
        .get(`/v1/payments/${paymentId}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      // Should be either SUCCESS or FAILED (80% success rate)
      expect(['SUCCESS', 'FAILED']).toContain(checkResponse.body.status);
      expect(checkResponse.body).toHaveProperty('processedAt');

      if (checkResponse.body.status === 'FAILED') {
        expect(checkResponse.body).toHaveProperty('failureReason');
      }

      // Webhook should have been sent
      expect(mockWebhookClient.sendPaymentWebhook).toHaveBeenCalled();
    }, 10000); // Increase timeout for this test

    it('should handle multiple concurrent payments', async () => {
      const paymentDtos = Array.from({ length: 5 }, (_, i) => ({
        externalReference: `sub_concurrent_${i}`,
        amount: 29.99,
        currency: 'USD',
      }));

      // Create all payments concurrently
      const createRequests = paymentDtos.map((dto, i) =>
        request(app.getHttpServer())
          .post('/v1/payments')
          .set('X-API-Key', apiKey)
          .set('Idempotency-Key', generateIdempotencyKey(`concurrent-${i}`))
          .send(dto)
      );

      const responses = await Promise.all(createRequests);

      // All should be created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('PENDING');
      });

      // Verify all payments are in database
      const payments = await prisma.paymentTransaction.findMany({
        where: {
          externalReference: {
            startsWith: 'sub_concurrent_',
          },
        },
      });
      expect(payments).toHaveLength(5);
    });
  });

  describe('Webhook Sending', () => {
    it.skip('should track webhook sending status', async () => {
      const paymentDto = {
        externalReference: 'sub_webhook_123',
        amount: 29.99,
        currency: 'USD',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(paymentDto)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Check payment
      const payment = await prisma.paymentTransaction.findUnique({
        where: { id: paymentId },
      });

      // Verify webhook tracking fields
      expect(payment?.webhookSent).toBe(true);
      expect(payment?.webhookRetryCount).toBeGreaterThanOrEqual(0);
      expect(payment?.webhookLastAttempt).toBeTruthy();
    }, 10000);

    it.skip('should handle webhook failures with retry', async () => {
      // Mock webhook failure
      mockWebhookClient.sendPaymentWebhook.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const paymentDto = {
        externalReference: 'sub_webhook_fail_123',
        amount: 29.99,
        currency: 'USD',
      };

      await request(app.getHttpServer())
        .post('/v1/payments')
        .set('X-API-Key', apiKey)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(paymentDto)
        .expect(201);

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Webhook client should have attempted to send
      expect(mockWebhookClient.sendPaymentWebhook).toHaveBeenCalled();
    }, 12000);
  });

  describe('Payment Statistics', () => {
    beforeEach(async () => {
      // Create various payment statuses
      await prisma.paymentTransaction.createMany({
        data: [
          {
            externalReference: 'sub_success_1',
            amount: 29.99,
            currency: 'USD',
            status: 'SUCCESS',
            processedAt: new Date(),
          },
          {
            externalReference: 'sub_success_2',
            amount: 99.99,
            currency: 'USD',
            status: 'SUCCESS',
            processedAt: new Date(),
          },
          {
            externalReference: 'sub_failed_1',
            amount: 29.99,
            currency: 'USD',
            status: 'FAILED',
            processedAt: new Date(),
            failureReason: 'Card declined',
          },
          {
            externalReference: 'sub_pending_1',
            amount: 29.99,
            currency: 'USD',
            status: 'PENDING',
          },
        ],
      });
    });

    it('should calculate success rate correctly', async () => {
      const allPayments = await prisma.paymentTransaction.findMany({
        where: {
          status: {
            in: ['SUCCESS', 'FAILED'],
          },
        },
      });

      const successCount = allPayments.filter(p => p.status === 'SUCCESS').length;
      const totalProcessed = allPayments.length;
      const successRate = (successCount / totalProcessed) * 100;

      // 2 success out of 3 processed = 66.67%
      expect(successRate).toBeCloseTo(66.67, 1);
    });

    it('should track total payment volume', async () => {
      const allPayments = await prisma.paymentTransaction.findMany({
        where: { status: 'SUCCESS' },
      });

      const totalVolume = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // 29.99 + 99.99 = 129.98
      expect(totalVolume).toBeCloseTo(129.98, 2);
    });
  });
});

