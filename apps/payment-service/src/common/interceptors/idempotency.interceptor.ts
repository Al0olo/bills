import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only apply to mutation operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    try {
      // Check if this idempotency key has been used before
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existingKey) {
        this.logger.log(
          `Idempotency key ${idempotencyKey} already processed, returning cached response`
        );
        return of(existingKey.response);
      }

      // Process the request and cache the response
      return next.handle().pipe(
        tap(async (response) => {
          try {
            await this.prisma.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                response: response,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
              },
            });
            this.logger.log(`Idempotency key ${idempotencyKey} cached`);
          } catch (error: any) {
            // If key already exists (race condition), ignore
            if (error?.code !== 'P2002') {
              this.logger.error(
                `Failed to cache idempotency key: ${error?.message}`
              );
            }
          }
        })
      );
    } catch (error) {
      this.logger.error(`Idempotency check failed: ${error}`);
      return next.handle();
    }
  }
}

