import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppConfig } from '@journal/shared';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const app = this.config.getOrThrow<AppConfig>('app');
    const client = new Redis({
      host: app.redis.host,
      port: app.redis.port,
      password: app.redis.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return this.getStatus(key, true);
    } catch (err) {
      await client.quit().catch(() => undefined);
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { message: String(err) }));
    }
  }
}
