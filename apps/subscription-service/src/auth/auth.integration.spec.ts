import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  createTestUserWithPassword,
  generateTestToken,
  TEST_USERS,
} from '@bills/testing';
import {
  cleanupDatabase,
  disconnectTestDb,
} from '../test-utils/test-db.helper';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same configuration as main.ts
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
    // Clean database before each test
    await cleanupDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await app.close();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');

      expect(response.body.user).toMatchObject({
        email: registerDto.email,
        name: registerDto.name,
      });

      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('createdAt');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { email: registerDto.email },
      });
      expect(user).toBeTruthy();
      expect(user?.name).toBe(registerDto.name);
    });

    it('should reject registration with duplicate email', async () => {
      const registerDto = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        name: 'Duplicate User',
      };

      // First registration
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(registerDto)
        .expect(201);

      // Second registration with same email
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should validate email format', async () => {
      const invalidDto = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(invalidDto)
        .expect(400);
    });

    it('should validate password strength', async () => {
      const weakPasswordDto = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      };

      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(weakPasswordDto)
        .expect(400);
    });

    it('should require all fields', async () => {
      const incompleteDto = {
        email: 'test@example.com',
        // missing password and name
      };

      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(incompleteDto)
        .expect(400);
    });
  });

  describe('POST /v1/auth/login', () => {
    const testUser = {
      email: 'login@example.com',
      password: 'SecurePass123!',
      name: 'Login Test User',
    };

    beforeEach(async () => {
      // Create test user
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');

      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          // missing password
        })
        .expect(401); // LocalStrategy returns 401 for missing fields
    });
  });

  describe('POST /v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePass123!',
          name: 'Refresh Test User',
        });

      refreshToken = registerResponse.body.refreshToken;
    });

    it('should refresh token successfully with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body.accessToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });

    it('should require refresh token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('Authentication Flow', () => {
    it('should complete full authentication cycle', async () => {
      // Step 1: Register
      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'fullcycle@example.com',
          password: 'SecurePass123!',
          name: 'Full Cycle User',
        })
        .expect(201);

      const { accessToken, refreshToken } = registerResponse.body;

      // Step 2: Access protected resource with access token
      const profileResponse = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.email).toBe('fullcycle@example.com');

      // Step 3: Refresh access token
      const refreshResponse = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const newAccessToken = refreshResponse.body.accessToken;

      // Step 4: Access protected resource with new access token
      await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Step 5: Login again
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'fullcycle@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      // Step 6: Verify login provides new tokens
      expect(loginResponse.body.accessToken).toBeTruthy();
      expect(loginResponse.body.refreshToken).toBeTruthy();
    });
  });
});

