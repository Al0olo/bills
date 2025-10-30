import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );

    // Build error response
    const errorResponse: any = {
      statusCode: status,
      message,
      error:
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as any).error || 'Error'
          : 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).id,
    };

    // Add validation errors if present
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as any).message)
    ) {
      errorResponse.errors = (exceptionResponse as any).message;
    }

    // Add details if present
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'details' in exceptionResponse
    ) {
      errorResponse.details = (exceptionResponse as any).details;
    }

    response.status(status).json(errorResponse);
  }
}

