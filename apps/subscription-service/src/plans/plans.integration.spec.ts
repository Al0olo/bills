import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateTestToken,
  generateIdempotencyKey,
  TEST_USERS,
} from '@bills/testing';
import {
  cleanupDatabase,
  disconnectTestDb,
} from '../test-utils/test-db.helper';

describe('Plans Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

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

    // Generate tokens
    const admin = TEST_USERS.admin;
    const user = TEST_USERS.user1;
    adminToken = generateTestToken(admin.id, admin.email, admin.role);
    userToken = generateTestToken(user.id, user.email, user.role);
  });

  beforeEach(async () => {
    await cleanupDatabase();
    
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

    // Create regular user
    await prisma.user.create({
      data: {
        id: TEST_USERS.user1.id,
        email: TEST_USERS.user1.email,
        name: TEST_USERS.user1.name,
        passwordHash: '$2b$10$TestHash',
        role: TEST_USERS.user1.role,
      },
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
    await app.close();
  });

  describe('GET /v1/plans', () => {
    it('should return empty list when no plans exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/plans')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all active plans', async () => {
      // Create test plans
      await prisma.plan.createMany({
        data: [
          {
            name: 'Basic Plan',
            description: 'Basic features',
            price: 9.99,
            billingCycle: 'MONTHLY',
            features: ['Feature 1'],
            isActive: true,
          },
          {
            name: 'Pro Plan',
            description: 'Pro features',
            price: 29.99,
            billingCycle: 'MONTHLY',
            features: ['Feature 1', 'Feature 2'],
            isActive: true,
          },
          {
            name: 'Inactive Plan',
            description: 'Inactive',
            price: 19.99,
            billingCycle: 'MONTHLY',
            features: ['Feature 1'],
            isActive: false,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/v1/plans')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((plan: any) => plan.isActive)).toBe(true);
    });

    it('should filter by isActive=false', async () => {
      await prisma.plan.createMany({
        data: [
          {
            name: 'Active Plan',
            price: 9.99,
            billingCycle: 'MONTHLY',
            features: [],
            isActive: true,
          },
          {
            name: 'Inactive Plan',
            price: 19.99,
            billingCycle: 'MONTHLY',
            features: [],
            isActive: false,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/v1/plans?isActive=false')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Inactive Plan');
    });

    it('should not require authentication (public endpoint)', async () => {
      await request(app.getHttpServer())
        .get('/v1/plans')
        .expect(200);
    });
  });

  describe('GET /v1/plans/:id', () => {
    let testPlanId: string;

    beforeEach(async () => {
      const plan = await prisma.plan.create({
        data: {
          name: 'Test Plan',
          description: 'Test Description',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: ['Feature 1', 'Feature 2'],
          isActive: true,
        },
      });
      testPlanId = plan.id;
    });

    it('should return plan by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/plans/${testPlanId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testPlanId,
        name: 'Test Plan',
        description: 'Test Description',
        price: 29.99,
        billingCycle: 'MONTHLY',
      });
      expect(response.body.features).toEqual(['Feature 1', 'Feature 2']);
    });

    it('should return 404 for non-existent plan', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440099';
      
      await request(app.getHttpServer())
        .get(`/v1/plans/${fakeId}`)
        .expect(404);
    });

    it('should return 400 for invalid uuid', async () => {
      await request(app.getHttpServer())
        .get('/v1/plans/invalid-id')
        .expect(400);
    });
  });

  describe('POST /v1/plans', () => {
    it('should create a new plan as admin', async () => {
      const createDto = {
        name: 'Enterprise Plan',
        description: 'For large organizations',
        price: 99.99,
        billingCycle: 'MONTHLY',
        features: ['Feature 1', 'Feature 2', 'Feature 3'],
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject(createDto);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Verify in database
      const plan = await prisma.plan.findUnique({
        where: { id: response.body.id },
      });
      expect(plan).toBeTruthy();
    });

    it('should reject plan creation without admin role', async () => {
      const createDto = {
        name: 'Unauthorized Plan',
        price: 29.99,
        billingCycle: 'MONTHLY',
        features: [],
      };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(createDto)
        .expect(403);
    });

    it('should reject plan creation without authentication', async () => {
      const createDto = {
        name: 'Unauthenticated Plan',
        price: 29.99,
        billingCycle: 'MONTHLY',
        features: [],
      };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(createDto)
        .expect(401);
    });

    it('should reject duplicate plan names', async () => {
      const createDto = {
        name: 'Unique Plan',
        price: 29.99,
        billingCycle: 'MONTHLY',
        features: [],
      };

      // First creation
      await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(createDto)
        .expect(201);

      // Second creation with same name
      await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(createDto)
        .expect(409);
    });

    it('should validate price is positive', async () => {
      const invalidDto = {
        name: 'Invalid Price Plan',
        price: -10,
        billingCycle: 'MONTHLY',
        features: [],
      };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(invalidDto)
        .expect(400);
    });

    it('should validate billing cycle enum', async () => {
      const invalidDto = {
        name: 'Invalid Cycle Plan',
        price: 29.99,
        billingCycle: 'DAILY', // Invalid
        features: [],
      };

      await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(invalidDto)
        .expect(400);
    });

    it('should enforce idempotency', async () => {
      const createDto = {
        name: 'Idempotent Plan',
        price: 29.99,
        billingCycle: 'MONTHLY',
        features: [],
      };

      const idempotencyKey = generateIdempotencyKey();

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(createDto)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(createDto)
        .expect(201);

      // Should return same result
      expect(response1.body.id).toBe(response2.body.id);

      // Verify only one plan was created
      const plans = await prisma.plan.findMany({
        where: { name: 'Idempotent Plan' },
      });
      expect(plans).toHaveLength(1);
    });
  });

  describe('PATCH /v1/plans/:id', () => {
    let testPlanId: string;

    beforeEach(async () => {
      const plan = await prisma.plan.create({
        data: {
          name: 'Original Plan',
          description: 'Original description',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: ['Feature 1'],
          isActive: true,
        },
      });
      testPlanId = plan.id;
    });

    it('should update plan as admin', async () => {
      const updateDto = {
        name: 'Updated Plan',
        description: 'Updated description',
        price: 39.99,
        features: ['Feature 1', 'Feature 2'],
      };

      const response = await request(app.getHttpServer())
        .patch(`/v1/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject(updateDto);
      expect(response.body.id).toBe(testPlanId);
    });

    it('should reject update without admin role', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ price: 39.99 })
        .expect(403);
    });

    it('should return 404 for non-existent plan', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440099';

      await request(app.getHttpServer())
        .patch(`/v1/plans/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .send({ price: 39.99 })
        .expect(404);
    });
  });

  describe('DELETE /v1/plans/:id', () => {
    let testPlanId: string;

    beforeEach(async () => {
      const plan = await prisma.plan.create({
        data: {
          name: 'Plan to Delete',
          price: 29.99,
          billingCycle: 'MONTHLY',
          features: [],
          isActive: true,
        },
      });
      testPlanId = plan.id;
    });

    it('should deactivate plan as admin (soft delete)', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .expect(200);

      // Verify plan is deactivated, not deleted
      const plan = await prisma.plan.findUnique({
        where: { id: testPlanId },
      });
      expect(plan).toBeTruthy();
      expect(plan?.isActive).toBe(false);
    });

    it('should reject deletion without admin role', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .expect(403);
    });

    it.skip('should return 404 for non-existent plan', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440099';

      await request(app.getHttpServer())
        .delete(`/v1/plans/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', generateIdempotencyKey())
        .expect(404);
    });
  });
});

