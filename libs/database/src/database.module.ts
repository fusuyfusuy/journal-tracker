import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '@journal/shared';
import { Article } from './entities/article.entity';
import { Journal } from './entities/journal.entity';
import { Subscriber } from './entities/subscriber.entity';
import { InitialSchema1776247402498 } from './migrations/1776247402498-InitialSchema';

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
          migrationsRun: true,
          migrations: [InitialSchema1776247402498],
        };
      },
    }),
    TypeOrmModule.forFeature([Journal, Article, Subscriber]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
