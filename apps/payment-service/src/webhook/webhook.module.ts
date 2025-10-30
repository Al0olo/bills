import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WebhookClientService } from './webhook-client.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [WebhookClientService],
  exports: [WebhookClientService],
})
export class WebhookModule {}


