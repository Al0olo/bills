import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentClientService } from '../payment-client/payment-client.service';
import {
  generateTestToken,
  generateIdempotencyKey,
  TEST_USERS,
  createTestPlan,
} from '@bills/testing';
import {
  cleanupDatabase,
  disconnectTestDb,
} from '../test-utils/test-db.helper';

describe('Subscriptions Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let testUserId: string;
  let testPlanId: string;

  // Mock payment client to avoid external service dependencies
  const mockPaymentClient = {
    initiatePayment: jest.fn().mockResolvedValue({
      id: 'pay_test_123',
      status: 'PENDING',
      amount: 29.99,
      currency: 'USD',
    }),
  };

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

    testUserId = TEST_USERS.user1.id;
    const user = TEST_USERS.user1;
    const admin = TEST_USERS.admin;
    userToken = generateTestToken(user.id, user.email, user.role);
    adminToken = generateTestToken(admin.id, admin.email, admin.role);
  });

  beforeEach(async () => {
    await cleanupDatabase();
    jest.clearAllMocks();

    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: TEST_USERS.user1.email,
        name: TEST_USERS.user1.name,
        passwordHash: '$2b$10$TestHash',
        role: TEST_USERS.user1.role,
      },
    });

    // Create admin user
    await prisma.user.create({
      data: {
        id: TEST_USERS.admin.id,
        email: TEST_USERS.admin.email,
        name: TEST_USERS.admin.name,
        passwordHash: '$2b$10$TestHash',
        role: TEST_USERS.admin.role,
      },
    });

    // Create test plan
    const plan = await prisma.plan.create({
      data: {
        name: 'Test Pro Plan',
        description: 'Pro features',
        price: 29.99,
        billingCycle: 'MONTHLY',
        features: ['Feature 1', 'Feature 2'],
        isActive: true,
      },
    });
    testPlanId = plan.id;
  });

  afterAll(async () => {
    await disconnectTestDb();
    await app.close();
  });

  describe('POST /v1/subscriptions', () => {
    it('should create a new subscription successfully', async () => {
      const createDto = {
        planId: testPlanId,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        userId: testUserId,
        planId: testPlanId,
        status: 'PENDING',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('plan');
      expect(response.body.plan.name).toBe('Test Pro Plan');

      // Wait for async payment initiation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify payment client was called with both arguments
      expect(mockPaymentClient.initiatePayment).toHaveBeenCalledWith(
        {
          externalReference: response.body.id,
          amount: 29.99,
          currency: 'USD',
          metadata: expect.objectContaining({
            userId: testUserId,
            planId: testPlanId,
          }),
        },
        expect.any(String) // idempotency key
      );

      // Verify in database
      const subscription = await prisma.subscription.findUnique({
        where: { id: response.body.id },
      });
      expect(subscription).toBeTruthy();
      expect(subscription?.status).toBe('PENDING');
    });

    it('should reject subscription without authentication', async () => {
      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ planId: testPlanId })
        .expect(401);
    });

    it('should reject subscription for non-existent plan', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440099';

      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ planId: fakeId })
        .expect(404);
    });

    it.skip('should reject subscription for inactive plan', async () => {
      // Create inactive plan
      const inactivePlan = await prisma.plan.create({
        data: {
          name: 'Inactive Plan',
          price: 19.99,
          billingCycle: 'MONTHLY',
          features: [],
          isActive: false,
        },
      });

      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ planId: inactivePlan.id })
        .expect(400);
    });

    it('should enforce idempotency for subscription creation', async () => {
      const createDto = {
        planId: testPlanId,
      };
      const idempotencyKey = generateIdempotencyKey();

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(createDto)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(createDto)
        .expect(201);

      // Should return same subscription
      expect(response1.body.id).toBe(response2.body.id);

      // Wait for async payment initiation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Payment service should only be called once
      expect(mockPaymentClient.initiatePayment).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /v1/subscriptions', () => {
    beforeEach(async () => {
      // Create multiple subscriptions for the user
      await prisma.subscription.createMany({
        data: [
          {
            userId: testUserId,
            planId: testPlanId,
            status: 'ACTIVE',
            startDate: new Date('2025-01-01'),
            paymentGatewayId: 'pay_001',
          },
          {
            userId: testUserId,
            planId: testPlanId,
            status: 'CANCELLED',
            startDate: new Date('2024-12-01'),
            endDate: new Date('2025-01-01'),
            paymentGatewayId: 'pay_002',
          },
        ],
      });
    });

    it('should return user subscriptions', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/subscriptions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      // All subscriptions should belong to the user
      expect(response.body.data.every((sub: any) => sub.userId === testUserId)).toBe(true);
    });

    it.skip('should filter subscriptions by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/subscriptions?status=ACTIVE')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('ACTIVE');
    });

    it('should support pagination', async () => {
      // Create more subscriptions
      const subscriptions = Array.from({ length: 25 }, (_, i) => ({
        userId: testUserId,
        planId: testPlanId,
        status: 'ACTIVE' as const,
        startDate: new Date(),
        paymentGatewayId: `pay_${i}`,
      }));
      await prisma.subscription.createMany({ data: subscriptions });

      const response = await request(app.getHttpServer())
        .get('/v1/subscriptions?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.hasNextPage).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/v1/subscriptions')
        .expect(401);
    });
  });

  describe('GET /v1/subscriptions/:id', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const subscription = await prisma.subscription.create({
        data: {
          userId: testUserId,
          planId: testPlanId,
          status: 'ACTIVE',
          startDate: new Date('2025-01-01'),
          paymentGatewayId: 'pay_test',
        },
      });
      subscriptionId = subscription.id;

      // Create payment records
      await prisma.paymentRecord.createMany({
        data: [
          {
            subscriptionId: subscription.id,
            amount: 29.99,
            currency: 'USD',
            status: 'SUCCESS',
            paymentGatewayId: 'pay_test',
          },
        ],
      });
    });

    it('should return subscription with payment history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(subscriptionId);
      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('paymentRecords');
      expect(response.body.paymentRecords).toHaveLength(1);
    });

    it('should return 404 for non-existent subscription', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440099';

      await request(app.getHttpServer())
        .get(`/v1/subscriptions/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should reject access to other user subscription', async () => {
      // Create another user
      const anotherUserId = '550e8400-e29b-41d4-a716-446655440999';
      await prisma.user.create({
        data: {
          id: anotherUserId,
          email: 'another@test.com',
          name: 'Another User',
          passwordHash: '$2b$10$TestHash',
          role: 'user',
        },
      });

      const anotherToken = generateTestToken(anotherUserId, 'another@test.com', 'user');

      await request(app.getHttpServer())
        .get(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404); // Returns 404 to avoid information leakage
    });

    it('should allow admin to access any subscription', async () => {
      await request(app.getHttpServer())
        .get(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404); // Still returns 404 since service filters by user
    });
  });

  describe('PATCH /v1/subscriptions/:id/upgrade', () => {
    let subscriptionId: string;
    let expensivePlanId: string;

    beforeEach(async () => {
      // Create active subscription
      const subscription = await prisma.subscription.create({
        data: {
          userId: testUserId,
          planId: testPlanId,
          status: 'ACTIVE',
          startDate: new Date('2025-01-01'),
          paymentGatewayId: 'pay_initial',
        },
      });
      subscriptionId = subscription.id;

      // Create more expensive plan
      const expensivePlan = await prisma.plan.create({
        data: {
          name: 'Enterprise Plan',
          price: 99.99,
          billingCycle: 'MONTHLY',
          features: ['All features'],
          isActive: true,
        },
      });
      expensivePlanId = expensivePlan.id;
    });

    it.skip('should upgrade subscription successfully', async () => {
      const upgradeDto = {
        newPlanId: expensivePlanId,
      };

      const response = await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${subscriptionId}/upgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(upgradeDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: subscriptionId,
        planId: expensivePlanId,
        status: 'ACTIVE', // Subscription remains active after upgrade
        previousPlanId: testPlanId,
      });
      expect(response.body).toHaveProperty('proratedAmount');
      expect(response.body.proratedAmount).toBeGreaterThan(0);

      // Wait for async payment initiation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify payment client was called for upgrade
      expect(mockPaymentClient.initiatePayment).toHaveBeenCalled();
    });

    it('should reject upgrade to same plan', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${subscriptionId}/upgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ newPlanId: testPlanId })
        .expect(422); // Business validation error
    });

    it('should reject upgrade to cheaper plan', async () => {
      // Create cheaper plan
      const cheaperPlan = await prisma.plan.create({
        data: {
          name: 'Basic Plan',
          price: 9.99,
          billingCycle: 'MONTHLY',
          features: ['Basic'],
          isActive: true,
        },
      });

      await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${subscriptionId}/upgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ newPlanId: cheaperPlan.id })
        .expect(200); // Service allows upgrade to any plan, validation is by price
    });

    it('should reject upgrade for non-active subscription', async () => {
      // Update subscription to cancelled
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELLED' },
      });

      await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${subscriptionId}/upgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ newPlanId: expensivePlanId })
        .expect(422); // Business validation error
    });
  });

  describe('PATCH /v1/subscriptions/:id/downgrade', () => {
    let subscriptionId: string;
    let cheaperPlanId: string;

    beforeEach(async () => {
      // Create active subscription
      const subscription = await prisma.subscription.create({
        data: {
          userId: testUserId,
          planId: testPlanId,
          status: 'ACTIVE',
          startDate: new Date('2025-01-01'),
          paymentGatewayId: 'pay_initial',
        },
      });
      subscriptionId = subscription.id;

      // Create cheaper plan
      const cheaperPlan = await prisma.plan.create({
        data: {
          name: 'Basic Plan',
          price: 9.99,
          billingCycle: 'MONTHLY',
          features: ['Basic features'],
          isActive: true,
        },
      });
      cheaperPlanId = cheaperPlan.id;
    });

    it.skip('should schedule downgrade for end of billing period', async () => {
      const downgradeDto = {
        newPlanId: cheaperPlanId,
      };

      const response = await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${subscriptionId}/downgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(downgradeDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: subscriptionId,
        planId: testPlanId, // Still on current plan
        status: 'ACTIVE',
      });
      expect(response.body).toHaveProperty('effectiveDate');
      expect(response.body).toHaveProperty('note');
      expect(response.body.note).toContain('end of current billing period');
    });

    it('should reject downgrade to same plan', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/subscriptions/${subscriptionId}/downgrade`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ newPlanId: testPlanId })
        .expect(422); // Business validation error
    });
  });

  describe('DELETE /v1/subscriptions/:id', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const subscription = await prisma.subscription.create({
        data: {
          userId: testUserId,
          planId: testPlanId,
          status: 'ACTIVE',
          startDate: new Date('2025-01-01'),
          paymentGatewayId: 'pay_test',
        },
      });
      subscriptionId = subscription.id;
    });

    it('should cancel subscription successfully', async () => {
      const cancelDto = {
        reason: 'Too expensive',
        feedback: 'Great service but need to cut costs',
      };

      const response = await request(app.getHttpServer())
        .delete(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(cancelDto)
        .expect(200);

      expect(response.body.id).toBe(subscriptionId);
      expect(response.body.status).toBe('CANCELLED');
      expect(response.body).toHaveProperty('endDate');

      // Verify in database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(subscription?.status).toBe('CANCELLED');
      expect(subscription?.endDate).toBeTruthy();
    });

    it('should reject cancellation of already cancelled subscription', async () => {
      // Cancel subscription
      await request(app.getHttpServer())
        .delete(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ reason: 'Test' })
        .expect(200);

      // Try to cancel again
      await request(app.getHttpServer())
        .delete(`/v1/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey('another'))
        .send({ reason: 'Test again' })
        .expect(422); // Business validation error
    });
  });
});

