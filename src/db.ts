// Non-action module: bun:sqlite init + schema migrations + CRUD for journals, articles, subscribers.

import { Database } from 'bun:sqlite';
import type { Journal, JournalInsert, Article, ArticleInsert, Subscriber, SubscriberInsert } from './types/index';
import { JournalSchema, JournalInsertSchema, ArticleSchema, ArticleInsertSchema, SubscriberSchema, SubscriberInsertSchema } from './types/index';

export type { Database };

/**
 * Non-action module: open (or create) the SQLite database at dbPath and run schema migrations.
 * Returns a ready-to-use bun:sqlite Database instance.
 *
 * Logic:
 *   1. import { Database } from 'bun:sqlite'
 *   2. new Database(dbPath, { create: true })
 *   3. db.exec('PRAGMA journal_mode=WAL') for write concurrency
 *   4. CREATE TABLE IF NOT EXISTS journals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, fetcher_type TEXT NOT NULL, feed_url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)
 *   5. CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, journal_id INTEGER NOT NULL REFERENCES journals(id), title TEXT NOT NULL, url TEXT NOT NULL, doi TEXT, published_at TEXT NOT NULL, dedupe_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)
 *   6. CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_type TEXT NOT NULL, destination TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)
 *   7. return db
 */
export function initDb(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });

  db.exec('PRAGMA journal_mode=WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      fetcher_type TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_id INTEGER NOT NULL REFERENCES journals(id),
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      doi TEXT,
      published_at TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_type TEXT NOT NULL,
      destination TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  return db;
}

// ---- journals CRUD ----

export function getActiveJournals(db: Database): Journal[] {
  const rows = db.prepare('SELECT * FROM journals WHERE active = 1').all() as Array<{
    id: number;
    name: string;
    fetcher_type: string;
    feed_url: string;
    active: number;
    created_at: string;
  }>;

  return rows.map((row) => {
    return JournalSchema.parse({
      id: row.id,
      name: row.name,
      fetcher_type: row.fetcher_type,
      feed_url: row.feed_url,
      active: row.active === 1,
      created_at: row.created_at,
    });
  });
}

export function insertJournal(db: Database, journal: JournalInsert): Journal {
  const validated = JournalInsertSchema.parse(journal);
  const created_at = validated.created_at || new Date().toISOString();

  db.prepare(
    'INSERT INTO journals (name, fetcher_type, feed_url, active, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(validated.name, validated.fetcher_type, validated.feed_url, validated.active ? 1 : 0, created_at);

  const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  const inserted = db.prepare('SELECT * FROM journals WHERE id = ?').get(lastId.id) as {
    id: number;
    name: string;
    fetcher_type: string;
    feed_url: string;
    active: number;
    created_at: string;
  };

  return JournalSchema.parse({
    id: inserted.id,
    name: inserted.name,
    fetcher_type: inserted.fetcher_type,
    feed_url: inserted.feed_url,
    active: inserted.active === 1,
    created_at: inserted.created_at,
  });
}

// ---- articles CRUD ----

export function articleExistsByDedupeKey(db: Database, dedupeKey: string): boolean {
  const result = db.prepare('SELECT 1 FROM articles WHERE dedupe_key = ? LIMIT 1').get(dedupeKey);
  return result !== null && result !== undefined;
}

export function insertArticle(db: Database, article: ArticleInsert): Article {
  const validated = ArticleInsertSchema.parse(article);
  const created_at = new Date().toISOString();

  db.prepare(
    'INSERT INTO articles (journal_id, title, url, doi, published_at, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(validated.journal_id, validated.title, validated.url, validated.doi, validated.published_at, validated.dedupe_key, created_at);

  const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  const inserted = db.prepare('SELECT * FROM articles WHERE id = ?').get(lastId.id) as {
    id: number;
    journal_id: number;
    title: string;
    url: string;
    doi: string | null;
    published_at: string;
    dedupe_key: string;
    created_at: string;
  };

  return ArticleSchema.parse({
    id: inserted.id,
    journal_id: inserted.journal_id,
    title: inserted.title,
    url: inserted.url,
    doi: inserted.doi,
    published_at: inserted.published_at,
    dedupe_key: inserted.dedupe_key,
    created_at: inserted.created_at,
  });
}

// ---- subscribers CRUD ----

export function getActiveSubscribers(db: Database): Subscriber[] {
  const rows = db.prepare('SELECT * FROM subscribers WHERE active = 1').all() as Array<{
    id: number;
    channel_type: string;
    destination: string;
    active: number;
    created_at: string;
  }>;

  return rows.map((row) => {
    return SubscriberSchema.parse({
      id: row.id,
      channel_type: row.channel_type,
      destination: row.destination,
      active: row.active === 1,
      created_at: row.created_at,
    });
  });
}

export function insertSubscriber(db: Database, subscriber: SubscriberInsert): Subscriber {
  const validated = SubscriberInsertSchema.parse(subscriber);
  const created_at = validated.created_at || new Date().toISOString();

  db.prepare(
    'INSERT INTO subscribers (channel_type, destination, active, created_at) VALUES (?, ?, ?, ?)'
  ).run(validated.channel_type, validated.destination, validated.active ? 1 : 0, created_at);

  const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  const inserted = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(lastId.id) as {
    id: number;
    channel_type: string;
    destination: string;
    active: number;
    created_at: string;
  };

  return SubscriberSchema.parse({
    id: inserted.id,
    channel_type: inserted.channel_type,
    destination: inserted.destination,
    active: inserted.active === 1,
    created_at: inserted.created_at,
  });
}
