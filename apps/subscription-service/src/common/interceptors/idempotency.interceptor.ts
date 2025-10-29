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
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;

    // Only apply idempotency to mutation operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as string;

    // Idempotency key is required for mutation operations
    if (!idempotencyKey) {
      return next.handle();
      // In production, you might want to make this required:
      // throw new BadRequestException('Idempotency-Key header is required');
    }

    // Generate hash of request body
    const bodyHash = this.generateHash(request.body || {});

    try {
      // Check if idempotency key exists
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        // Check if body hash matches
        if (existing.requestBodyHash !== bodyHash) {
          this.logger.warn(
            `Idempotency key conflict: ${idempotencyKey} with different body`
          );
          throw new ConflictException({
            message: 'Idempotency key already used with different request body',
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            details: {
              idempotencyKey,
              originalRequestPath: existing.requestPath,
              currentRequestPath: request.path,
            },
          });
        }

        // Return cached response
        this.logger.log(
          `Returning cached response for idempotency key: ${idempotencyKey}`
        );
        response.status(existing.responseStatus || 200);
        return of(existing.responseBody);
      }

      // Process the request and cache the response
      return next.handle().pipe(
        tap(async (data) => {
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

            await this.prisma.idempotencyKey.create({
              data: {
                idempotencyKey,
                requestMethod: method,
                requestPath: request.path,
                requestBodyHash: bodyHash,
                responseStatus: response.statusCode,
                responseBody: data,
                expiresAt,
              },
            });

            this.logger.log(
              `Stored idempotency key: ${idempotencyKey} for path: ${request.path}`
            );
          } catch (error) {
            // Log error but don't fail the request
            this.logger.error(
              `Failed to store idempotency key: ${error.message}`
            );
          }
        })
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      // Log error and continue with request
      this.logger.error(`Idempotency check failed: ${error.message}`);
      return next.handle();
    }
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}

