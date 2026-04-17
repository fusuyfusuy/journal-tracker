import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Journal } from './entities/journal.entity';
import { Article } from './entities/article.entity';
import { Subscriber } from './entities/subscriber.entity';
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? './data/journal-tracker.db',
  entities: [Journal, Article, Subscriber],
  migrations: ['libs/database/src/migrations/*{.ts,.js}'],
  synchronize: false,
});
