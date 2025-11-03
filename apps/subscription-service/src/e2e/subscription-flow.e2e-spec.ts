import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentClientService } from '../payment-client/payment-client.service';
import {
  generateIdempotencyKey,
} from '@bills/testing';
import {
  cleanupDatabase,
  disconnectTestDb,
} from '../test-utils/test-db.helper';
import * as crypto from 'crypto';

describe('Complete Subscription Flow E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const webhookSecret = process.env.WEBHOOK_SECRET || 'test-webhook-secret';

  // Mock payment client for controlled testing
  const mockPaymentClient = {
    initiatePayment: jest.fn().mockResolvedValue({
      id: 'pay_mock_123',
      status: 'PENDING',
      amount: 29.99,
      currency: 'USD',
    }),
  };

  // Helper function to generate webhook signature
  function generateWebhookSignature(payload: any): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payloadString);
    return hmac.digest('hex');
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentClientService)
      .useValue(mockPaymentClient)
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

  describe('Complete User Journey: Registration to Active Subscription', () => {
    it('should complete full journey from registration to active subscription', async () => {
      // Step 1: Register new user
      const registerDto = {
        email: 'journey@example.com',
        password: 'SecurePass123!',
        name: 'Journey User',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(registerDto)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('accessToken');
      const userToken = registerResponse.body.accessToken;
      const userId = registerResponse.body.user.id;

      // Step 2: Browse available plans (public endpoint)
      const plansResponse = await request(app.getHttpServer())
        .get('/v1/plans')
        .expect(200);

      // Create a plan if none exist
      let planId: string;
      if (plansResponse.body.length === 0) {
        // Login as admin to create plan
        const adminRegister = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .send({
            email: 'admin@journey.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          });

        // Update admin role
        await prisma.user.update({
          where: { email: 'admin@journey.com' },
          data: { role: 'admin' },
        });

        const adminToken = adminRegister.body.accessToken;

        const planResponse = await request(app.getHttpServer())
          .post('/v1/plans')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Idempotency-Key', generateIdempotencyKey())
          .send({
            name: 'Pro Plan',
            description: 'Professional features',
            price: 29.99,
            billingCycle: 'MONTHLY',
            features: ['Feature 1', 'Feature 2'],
            isActive: true,
          })
          .expect(201);

        planId = planResponse.body.id;
      } else {
        planId = plansResponse.body[0].id;
      }

      // Step 3: View specific plan details
      const planDetailsResponse = await request(app.getHttpServer())
        .get(`/v1/plans/${planId}`)
        .expect(200);

      expect(planDetailsResponse.body.name).toBeTruthy();
      expect(planDetailsResponse.body.price).toBeTruthy();

      // Step 4: Create subscription
      const subscriptionResponse = await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ planId })
        .expect(201);

      expect(subscriptionResponse.body.status).toBe('PENDING');
      const subscriptionId = subscriptionResponse.body.id;

      // Verify payment was initiated
      expect(mockPaymentClient.initiatePayment).toHaveBeenCalledWith({
        externalReference: subscriptionId,
        amount: planDetailsResponse.body.price,
        currency: 'USD',
        metadata: expect.objectContaining({
          userId,
          planId,
        }),
      });

      // Step 5: Payment service processes payment and sends webhook (simulated)
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_journey_123',
        externalReference: subscriptionId,
        status: 'success',
        amount: planDetailsResponse.body.price,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const signature = generateWebhookSignature(webhookPayload);

      await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(200);

      // Step 6: Check subscription is now active
      const activeSubscriptionResponse = await request(app.getHttpServer())
        .get(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(activeSubscriptionResponse.body.status).toBe('ACTIVE');
      expect(activeSubscriptionResponse.body.paymentRecords).toHaveLength(1);
      expect(activeSubscriptionResponse.body.paymentRecords[0].status).toBe('SUCCESS');

      // Step 7: List user subscriptions
      const subscriptionsListResponse = await request(app.getHttpServer())
        .get('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(subscriptionsListResponse.body.data).toHaveLength(1);
      expect(subscriptionsListResponse.body.data[0].status).toBe('ACTIVE');

      // Step 8: View user profile
      const profileResponse = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(profileResponse.body.email).toBe(registerDto.email);
    });
  });

  describe('Subscription Upgrade Flow', () => {
    it('should successfully upgrade from basic to pro plan', async () => {
      // Setup: Create user, basic plan, and active subscription
      const user = await prisma.user.create({
        data: {
          email: 'upgrade@test.com',
          name: 'Upgrade User',
          passwordHash: '$2b$10$TestHash',
          role: 'user',
        },
      });

      const basicPlan = await prisma.plan.create({
        data: {
          name: 'Basic Plan',
          price: 9.99,
          billingCycle: 'MONTHLY',
          features: ['Basic Feature'],
          isActive: true,
        },
      });

      const proPlan = await prisma.plan.create({
        data: {
          name: 'Pro Plan',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: ['Pro Features'],
          isActive: true,
        },
      });

      const activeSubscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: basicPlan.id,
          status: 'ACTIVE',
          startDate: new Date(),
          paymentGatewayId: 'pay_initial',
        },
      });

      // Generate token
      const JwtService = require('@nestjs/jwt').JwtService;
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum',
      });
      const userToken = jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // Step 1: Initiate upgrade
      const upgradeResponse = await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${activeSubscription.id}/upgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ newPlanId: proPlan.id })
        .expect(200);

      expect(upgradeResponse.body.status).toBe('PENDING');
      expect(upgradeResponse.body.planId).toBe(proPlan.id);
      expect(upgradeResponse.body.previousPlanId).toBe(basicPlan.id);
      expect(upgradeResponse.body.proratedAmount).toBeGreaterThan(0);

      // Step 2: Simulate successful upgrade payment webhook
      const webhookPayload = {
        eventType: 'payment.completed',
        paymentId: 'pay_upgrade_123',
        externalReference: activeSubscription.id,
        status: 'success',
        amount: upgradeResponse.body.proratedAmount,
        currency: 'USD',
        timestamp: new Date().toISOString(),
      };

      const signature = generateWebhookSignature(webhookPayload);

      await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(200);

      // Step 3: Verify upgrade completed
      const updatedSubscription = await request(app.getHttpServer())
        .get(`/v1/subscriptions/${activeSubscription.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedSubscription.body.status).toBe('ACTIVE');
      expect(updatedSubscription.body.planId).toBe(proPlan.id);
      expect(updatedSubscription.body.plan.name).toBe('Pro Plan');
      expect(updatedSubscription.body.paymentRecords.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Subscription Downgrade Flow', () => {
    it('should schedule downgrade for end of billing period', async () => {
      // Setup
      const user = await prisma.user.create({
        data: {
          email: 'downgrade@test.com',
          name: 'Downgrade User',
          passwordHash: '$2b$10$TestHash',
          role: 'user',
        },
      });

      const proPlan = await prisma.plan.create({
        data: {
          name: 'Pro Plan',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: ['Pro Features'],
          isActive: true,
        },
      });

      const basicPlan = await prisma.plan.create({
        data: {
          name: 'Basic Plan',
          price: 9.99,
          billingCycle: 'MONTHLY',
          features: ['Basic Features'],
          isActive: true,
        },
      });

      const activeSubscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          startDate: new Date(),
          paymentGatewayId: 'pay_pro',
        },
      });

      const JwtService = require('@nestjs/jwt').JwtService;
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum',
      });
      const userToken = jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // Initiate downgrade
      const downgradeResponse = await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${activeSubscription.id}/downgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ newPlanId: basicPlan.id })
        .expect(200);

      // Should still be on pro plan (downgrade scheduled)
      expect(downgradeResponse.body.planId).toBe(proPlan.id);
      expect(downgradeResponse.body.status).toBe('ACTIVE');
      expect(downgradeResponse.body).toHaveProperty('effectiveDate');
      expect(downgradeResponse.body).toHaveProperty('note');
      expect(downgradeResponse.body.note).toContain('end of current billing period');
    });
  });

  describe('Subscription Cancellation Flow', () => {
    it('should complete cancellation flow with feedback', async () => {
      // Setup
      const user = await prisma.user.create({
        data: {
          email: 'cancel@test.com',
          name: 'Cancel User',
          passwordHash: '$2b$10$TestHash',
          role: 'user',
        },
      });

      const plan = await prisma.plan.create({
        data: {
          name: 'Test Plan',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: [],
          isActive: true,
        },
      });

      const activeSubscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: new Date(),
          paymentGatewayId: 'pay_active',
        },
      });

      const JwtService = require('@nestjs/jwt').JwtService;
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum',
      });
      const userToken = jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // Cancel subscription
      const cancelDto = {
        reason: 'Too expensive',
        feedback: 'Great product but need to cut costs',
      };

      const cancelResponse = await request(app.getHttpServer())
        .delete(`/v1/subscriptions/${activeSubscription.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(cancelDto)
        .expect(200);

      expect(cancelResponse.body.status).toBe('CANCELLED');
      expect(cancelResponse.body.endDate).toBeTruthy();

      // Verify in database
      const cancelledSub = await prisma.subscription.findUnique({
        where: { id: activeSubscription.id },
      });
      expect(cancelledSub?.status).toBe('CANCELLED');

      // List subscriptions should show cancelled
      const listResponse = await request(app.getHttpServer())
        .get('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const cancelledSubscription = listResponse.body.data.find(
        (sub: any) => sub.id === activeSubscription.id
      );
      expect(cancelledSubscription.status).toBe('CANCELLED');
    });
  });

  describe('Failed Payment Flow', () => {
    it('should handle failed payment and cancel subscription', async () => {
      // Setup user and plan
      const user = await prisma.user.create({
        data: {
          email: 'failedpayment@test.com',
          name: 'Failed Payment User',
          passwordHash: '$2b$10$TestHash',
          role: 'user',
        },
      });

      const plan = await prisma.plan.create({
        data: {
          name: 'Test Plan',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: [],
          isActive: true,
        },
      });

      const JwtService = require('@nestjs/jwt').JwtService;
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum',
      });
      const userToken = jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // Create subscription
      const subscriptionResponse = await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ planId: plan.id })
        .expect(201);

      const subscriptionId = subscriptionResponse.body.id;

      // Send failed payment webhook
      const webhookPayload = {
        eventType: 'payment.failed',
        paymentId: 'pay_failed_123',
        externalReference: subscriptionId,
        status: 'failed',
        amount: 29.99,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        failureReason: 'Insufficient funds',
      };

      const signature = generateWebhookSignature(webhookPayload);

      const webhookResponse = await request(app.getHttpServer())
        .post('/v1/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.newStatus).toBe('CANCELLED');

      // Verify subscription is cancelled
      const checkResponse = await request(app.getHttpServer())
        .get(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(checkResponse.body.status).toBe('CANCELLED');
      expect(checkResponse.body.paymentRecords[0].status).toBe('FAILED');
      expect(checkResponse.body.paymentRecords[0].failureReason).toBe('Insufficient funds');
    });
  });
});

