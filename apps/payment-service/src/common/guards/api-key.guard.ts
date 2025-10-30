import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector
  ) {
    this.apiKey = this.configService.get<string>('apiKey')!;
  }

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      this.logger.warn('API key missing');
      throw new UnauthorizedException({
        message: 'API key is required',
        code: 'API_KEY_REQUIRED',
      });
    }

    if (apiKey !== this.apiKey) {
      this.logger.warn('Invalid API key provided');
      throw new UnauthorizedException({
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    return true;
  }
}

