import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number' },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('db')
  @ApiOperation({ summary: 'Database connectivity check' })
  @ApiResponse({
    status: 200,
    description: 'Database is connected',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        latency: { type: 'number' },
        connected: { type: 'boolean' },
      },
    },
  })
  async checkDatabase() {
    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: 'ok',
        latency,
        connected: true,
      };
    } catch (error: any) {
      return {
        status: 'error',
        latency: Date.now() - start,
        connected: false,
        error: error.message,
      };
    }
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        dependencies: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'ok' },
          },
        },
      },
    },
  })
  async ready() {
    const dbStatus = await this.checkDatabase();

    return {
      status: dbStatus.connected ? 'ok' : 'error',
      dependencies: {
        database: dbStatus.connected ? 'ok' : 'error',
      },
    };
  }
}


