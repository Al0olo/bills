import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Get configuration
  const port = configService.get<number>('port') || 3000;
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-ID',
      'X-Webhook-Signature',
    ],
  });

  // Trust proxy (for deployment behind load balancer)
  // app.set('trust proxy', 1); // Enable in production

  // Request ID middleware
  app.use((req: any, res: any, next: any) => {
    req.id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert types based on TS reflection
      },
    })
  );

  // Swagger documentation
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Subscription Service API')
      .setDescription(
        'Microservices-based subscription billing system - Subscription Management Service'
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        'JWT'
      )
      .addTag('Authentication', 'User authentication and token management')
      .addTag('Users', 'User profile management')
      .addTag('Plans', 'Subscription plan management')
      .addTag('Subscriptions', 'Subscription lifecycle management')
      .addTag('Webhooks', 'Webhook endpoints for payment updates')
      .addTag('Health', 'Health check endpoints')
      .addServer('http://localhost:3000', 'Local development')
      .addServer('http://subscription-service:3000', 'Docker environment')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });

    logger.log('Swagger documentation available at http://localhost:3000/api');
  }

  // Graceful shutdown
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // Start server
  await app.listen(port);

  logger.log(`🚀 Subscription Service is running on port ${port}`);
  logger.log(`📚 Environment: ${nodeEnv}`);
  logger.log(`📖 API Documentation: http://localhost:${port}/api`);
  logger.log(`❤️  Health Check: http://localhost:${port}/health`);
}

// Add shutdown hooks to Prisma
declare module './prisma/prisma.service' {
  interface PrismaService {
    enableShutdownHooks(app: any): Promise<void>;
  }
}

PrismaService.prototype.enableShutdownHooks = async function (app: any) {
  process.on('SIGINT', async () => {
    await app.close();
  });
  process.on('SIGTERM', async () => {
    await app.close();
  });
};

bootstrap();
