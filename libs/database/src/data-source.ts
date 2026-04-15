import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Journal } from './entities/journal.entity';
import { Article } from './entities/article.entity';
import { Subscriber } from './entities/subscriber.entity';
import { InitialSchema1776247402498 } from './migrations/1776247402498-InitialSchema';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? './data/journal-tracker.db',
  entities: [Journal, Article, Subscriber],
  migrations: [InitialSchema1776247402498],
  synchronize: false,
});
