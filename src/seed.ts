// seed.ts — out-of-band seed script to insert initial journals and subscribers.
// Run with: bun src/seed.ts
// Changes are picked up by the next scheduler cycle without restart.

import type { JournalInsert, SubscriberInsert } from './types/index';
import { loadConfig } from './config';
import { initDb, insertJournal, insertSubscriber } from './db';

/**
 * Seed the database with initial journals and subscribers.
 * Uses insertJournal() and insertSubscriber() from src/db.ts.
 * Idempotent: skips rows that already exist (caught by UNIQUE constraints).
 */
async function seed(): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.dbPath);

  const JOURNALS: JournalInsert[] = [
    {
      name: 'Nature',
      fetcher_type: 'rss',
      feed_url: 'https://www.nature.com/nature/current_issue/rss',
      active: true,
    },
    {
      name: 'Science',
      fetcher_type: 'rss',
      feed_url: 'https://www.science.org/journal/science/latest',
      active: true,
    },
    {
      name: 'arXiv',
      fetcher_type: 'arxiv',
      feed_url: 'https://arxiv.org/list/cs.LG/recent',
      active: true,
    },
  ];

  for (const j of JOURNALS) {
    try {
      insertJournal(db, j);
      console.log(JSON.stringify({ level: 'info', msg: 'seed.journal.ok', name: j.name, ts: new Date().toISOString() }));
    } catch (e) {
      console.log(JSON.stringify({ level: 'warn', msg: 'seed.journal.skip', name: j.name, reason: (e as Error).message, ts: new Date().toISOString() }));
    }
  }

  const SUBSCRIBERS: SubscriberInsert[] = [
    {
      channel_type: 'email',
      destination: 'user@example.com',
      active: true,
    },
    {
      channel_type: 'webhook',
      destination: 'https://example.com/webhook',
      active: true,
    },
  ];

  for (const s of SUBSCRIBERS) {
    try {
      insertSubscriber(db, s);
      console.log(JSON.stringify({ level: 'info', msg: 'seed.subscriber.ok', destination: s.destination, ts: new Date().toISOString() }));
    } catch (e) {
      console.log(JSON.stringify({ level: 'warn', msg: 'seed.subscriber.skip', destination: s.destination, reason: (e as Error).message, ts: new Date().toISOString() }));
    }
  }

  console.log(JSON.stringify({ level: 'info', msg: 'seed.complete', ts: new Date().toISOString() }));
}

seed().catch((err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'seed.fatal', error: String(err), ts: new Date().toISOString() }));
  process.exit(1);
});
