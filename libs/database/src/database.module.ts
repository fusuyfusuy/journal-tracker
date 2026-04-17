import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '@journal/shared';
import { Article } from './entities/article.entity';
import { Journal } from './entities/journal.entity';
import { Subscriber } from './entities/subscriber.entity';
import { MIGRATIONS } from './migrations';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): import('typeorm').DataSourceOptions => {
        const app = config.getOrThrow<AppConfig>('app');
        return {
          type: 'better-sqlite3',
          database: app.dbPath,
          entities: [Journal, Article, Subscriber],
          synchronize: app.dbSynchronize,
          migrationsRun: !app.dbSynchronize,
          migrations: MIGRATIONS,
        };
      },
    }),
    TypeOrmModule.forFeature([Journal, Article, Subscriber]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
