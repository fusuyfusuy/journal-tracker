import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1776247402498 implements MigrationInterface {
  name = 'InitialSchema1776247402498';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journals" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" text NOT NULL,
        "fetcher_type" text NOT NULL,
        "feed_url" text NOT NULL,
        "active" integer NOT NULL DEFAULT (1),
        "created_at" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "articles" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "journal_id" integer NOT NULL,
        "title" text NOT NULL,
        "url" text NOT NULL,
        "doi" text,
        "published_at" datetime NOT NULL,
        "dedupe_key" text NOT NULL,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_articles_journal" FOREIGN KEY ("journal_id") REFERENCES "journals" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_articles_dedupe" ON "articles" ("dedupe_key")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscribers" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "channel_type" text NOT NULL,
        "destination" text NOT NULL,
        "active" integer NOT NULL DEFAULT (1),
        "created_at" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_articles_dedupe"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "articles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "journals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscribers"`);
  }
}
