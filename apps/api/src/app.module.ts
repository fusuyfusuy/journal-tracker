import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@journal/database';
import { AppConfig, LoggingModule, appConfig } from '@journal/shared';
import { CyclesModule } from './cycles/cycles.controller';
import { HealthModule } from './health/health.module';
import { JournalsModule } from './journals/journals.module';
import { SubscribersModule } from './subscribers/subscribers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    LoggingModule,
    DatabaseModule,
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
})
export class AppModule {}
