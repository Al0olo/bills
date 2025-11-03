import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../node_modules/.prisma/payment-client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
    
    // Verify DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Log DATABASE_URL for debugging (masking password)
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log('🔍 PrismaService (Payment) DATABASE_URL:', maskedUrl);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Successfully connected to database');

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore - Prisma event types
      this.$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // @ts-ignore - Prisma event types
    this.$on('error', (e: any) => {
      this.logger.error(`Database error: ${e.message}`);
    });

    // @ts-ignore - Prisma event types
    this.$on('warn', (e: any) => {
      this.logger.warn(`Database warning: ${e.message}`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Execute a transaction with retry logic
   */
  async executeTransaction<T>(
    fn: (tx: any) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // @ts-ignore - Prisma transaction type
        return await this.$transaction(fn, {
          maxWait: 5000,
          timeout: 10000,
        });
      } catch (error: any) {
        lastError = error as Error;
        this.logger.warn(
          `Transaction attempt ${attempt}/${maxRetries} failed: ${error?.message || 'Unknown error'}`
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          );
        }
      }
    }

    this.logger.error(`Transaction failed after ${maxRetries} attempts`);
    throw lastError!;
  }

  /**
   * Clean up expired idempotency keys
   */
  async cleanupExpiredIdempotencyKeys(): Promise<number> {
    const result = await this.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}

