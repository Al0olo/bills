import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhookModule } from './webhook/webhook.module';
import { HealthModule } from './health/health.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Core modules
    PrismaModule,
    WebhookModule,

    // Feature modules
    PaymentsModule,
    HealthModule,
  ],
  providers: [
    // Global API key guard
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    // Global rate limit guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}


