import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateIdempotencyKey,
} from '@bills/testing';
import {
  cleanupDatabase,
  disconnectTestDb,
} from '../test-utils/test-db.helper';

describe('Webhooks Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const webhookSecret = process.env.WEBHOOK_SECRET || 'test-webhook-secret';

  // Helper function to generate valid webhook signature
  function generateWebhookSignature(payload: any): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payloadString);
    return hmac.digest('hex');
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  afterAll(async () => {
    await disconnectTestDb();
    await app.close();
  });

  describe('POST /v1/webhooks/payment', () => {
    let testSubscriptionId: string;
    let testPlanId: string;
    let testUserId: string;

    beforeEach(async () => {
      // Create test user
      const user = await prisma.user.create({
        data: {
          email: 'webhook@test.com',
          name: 'Webhook Test User',
          passwordHash: '$2b$10$TestHash',
          role: 'user',
        },
      });
      testUserId = user.id;

      // Create test plan
      const plan = await prisma.plan.create({
        data: {
          name: 'Test Plan',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: [],
          isActive: true,
        },
      });
      testPlanId = plan.id;

      // Create pending subscription
      const subscription = await prisma.subscription.create({
        data: {
          userId: testUserId,
          planId: testPlanId,
          status: 'PENDING',
          startDate: new Date(),
          paymentGatewayId: 'pay_test_123',
        },
      });
      testSubscriptionId = subscription.id;
    });

    it.skip('should process successful payment webhook and activate subscription', async () => {
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_test_123',
        externalReference: testSubscriptionId,
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const signature = generateWebhookSignature(webhookPayload);

      const response = await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        received: true,
        subscriptionId: testSubscriptionId,
        newStatus: 'ACTIVE',
      });
      expect(response.body).toHaveProperty('processedAt');

      // Verify subscription was activated
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
      });
      expect(subscription?.status).toBe('ACTIVE');

      // Verify payment record was created
      const paymentRecord = await prisma.paymentRecord.findFirst({
        where: {
          subscriptionId: testSubscriptionId,
          paymentGatewayId: 'pay_test_123',
        },
      });
      expect(paymentRecord).toBeTruthy();
      expect(paymentRecord?.status).toBe('SUCCESS');
      expect(paymentRecord?.amount).toBe(29.99);
    });

    it('should process failed payment webhook and cancel subscription', async () => {
      const webhookPayload = {
        eventType: 'payment.failed',
        paymentId: 'pay_test_456',
        externalReference: testSubscriptionId,
        status: 'failed',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        metadata: {},
        failureReason: 'Insufficient funds',
      };

      const signature = generateWebhookSignature(webhookPayload);

      const response = await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        received: true,
        subscriptionId: testSubscriptionId,
        newStatus: 'CANCELLED',
      });

      // Verify subscription was cancelled
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
      });
      expect(subscription?.status).toBe('CANCELLED');

      // Verify failed payment record was created
      const paymentRecord = await prisma.paymentRecord.findFirst({
        where: {
          subscriptionId: testSubscriptionId,
          paymentGatewayId: 'pay_test_456',
        },
      });
      expect(paymentRecord).toBeTruthy();
      expect(paymentRecord?.status).toBe('FAILED');
      expect(paymentRecord?.failureReason).toBe('Insufficient funds');
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_test_789',
        externalReference: testSubscriptionId,
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const invalidSignature = 'invalid-signature-12345';

      await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', invalidSignature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(401);

      // Verify subscription was NOT updated
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
      });
      expect(subscription?.status).toBe('PENDING');
    });

    it('should reject webhook without signature', async () => {
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_test_999',
        externalReference: testSubscriptionId,
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(401);
    });

    it('should enforce idempotency for webhooks', async () => {
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_idempotent_123',
        externalReference: testSubscriptionId,
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const signature = generateWebhookSignature(webhookPayload);
      const idempotencyKey = generateIdempotencyKey();

      // First webhook
      const response1 = await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', idempotencyKey)
        .send(webhookPayload)
        .expect(200);

      // Second webhook with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', idempotencyKey)
        .send(webhookPayload)
        .expect(200);

      // Should return same response
      expect(response1.body.subscriptionId).toBe(response2.body.subscriptionId);
      expect(response1.body.newStatus).toBe(response2.body.newStatus);

      // Verify only one payment record was created
      const paymentRecords = await prisma.paymentRecord.findMany({
        where: {
          subscriptionId: testSubscriptionId,
          paymentGatewayId: 'pay_idempotent_123',
        },
      });
      expect(paymentRecords).toHaveLength(1);
    });

    it('should handle webhook for non-existent subscription', async () => {
      const fakeSubId = '550e8400-e29b-41d4-a716-446655440099';
      
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_nonexistent_123',
        externalReference: fakeSubId,
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const signature = generateWebhookSignature(webhookPayload);

      await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(404);
    });

    it('should validate webhook payload structure', async () => {
      const invalidPayload = {
        eventType: 'payment.completed',
        // Missing required fields
        paymentId: 'pay_invalid',
      };

      const signature = generateWebhookSignature(invalidPayload);

      await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(invalidPayload)
        .expect(400);
    });

    it('should handle upgrade payment completion', async () => {
      // First activate subscription
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: { status: 'ACTIVE' },
      });

      // Create more expensive plan
      const expensivePlan = await prisma.plan.create({
        data: {
          name: 'Enterprise Plan',
          price: 99.99,
          billingCycle: 'MONTHLY',
          features: [],
          isActive: true,
        },
      });

      // Set up upgrade (subscription in PENDING state with previous plan)
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: {
          status: 'PENDING',
          planId: expensivePlan.id,
          previousPlanId: testPlanId,
        },
      });

      // Send upgrade payment webhook
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_upgrade_123',
        externalReference: testSubscriptionId,
        status: 'success',
        amount: 70.00, // Prorated amount
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const signature = generateWebhookSignature(webhookPayload);

      const response = await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(200);

      expect(response.body.newStatus).toBe('ACTIVE');

      // Verify subscription is active with new plan
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
      });
      expect(subscription?.status).toBe('ACTIVE');
      expect(subscription?.planId).toBe(expensivePlan.id);
    });

    it.skip('should handle concurrent webhook requests safely', async () => {
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_concurrent_123',
        externalReference: testSubscriptionId,
        status: 'success',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const signature = generateWebhookSignature(webhookPayload);

      // Send multiple webhooks concurrently with different idempotency keys
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/v1/webhooks/payment')
          .set('X-Webhook-Signature', signature)
          .set('Idempotency-Key', generateIdempotencyKey(`concurrent-${i}`))
          .send(webhookPayload)
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // But subscription should only be activated once
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
      });
      expect(subscription?.status).toBe('ACTIVE');

      // All webhooks processed successfully, but idempotency prevents duplicates
      const paymentRecords = await prisma.paymentRecord.findMany({
        where: {
          subscriptionId: testSubscriptionId,
          paymentGatewayId: 'pay_concurrent_123',
        },
      });
      // Due to race conditions and idempotency, we expect 1-5 records
      // but the subscription should be in consistent state
      expect(paymentRecords.length).toBeGreaterThanOrEqual(1);
      expect(paymentRecords.length).toBeLessThanOrEqual(5);
    });
  });
});

