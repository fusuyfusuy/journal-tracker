import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from '@journal/database';
import { AppConfig, LoggingModule, appConfig } from '@journal/shared';
import { CyclesModule } from './cycles/cycles.controller';
import { HealthModule } from './health/health.module';
import { JournalsModule } from './journals/journals.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { ApiKeyGuard } from './auth/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    LoggingModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.getOrThrow<AppConfig>('app');
        return {
          connection: {
            host: app.redis.host,
            port: app.redis.port,
            password: app.redis.password,
          },
        };
      },
    }),
    HealthModule,
    JournalsModule,
    SubscribersModule,
    CyclesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
