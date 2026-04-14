import { describe, it, expect } from 'bun:test';
import {
  initDb,
  getActiveJournals,
  insertJournal,
  articleExistsByDedupeKey,
  insertArticle,
  getActiveSubscribers,
  insertSubscriber,
} from '../src/db';

function freshDb() {
  return initDb(':memory:');
}

describe('initDb', () => {
  it('opens an in-memory db and creates journals/articles/subscribers tables', () => {
    const db = freshDb();
    // tables exist if we can query without throwing
    expect(() => db.query('SELECT 1 FROM journals LIMIT 1').all()).not.toThrow();
    expect(() => db.query('SELECT 1 FROM articles LIMIT 1').all()).not.toThrow();
    expect(() => db.query('SELECT 1 FROM subscribers LIMIT 1').all()).not.toThrow();
  });
});

describe('journals CRUD', () => {
  it('insertJournal round-trips and getActiveJournals returns it', () => {
    const db = freshDb();
    const j = insertJournal(db, {
      name: 'Nature',
      fetcher_type: 'rss',
      feed_url: 'https://example.com/feed.xml',
      active: true,
    });
    expect(j.id).toBeGreaterThan(0);
    expect(j.name).toBe('Nature');
    const all = getActiveJournals(db);
    expect(all.length).toBe(1);
    expect(all[0]!.name).toBe('Nature');
  });

  it('rejects JournalInsert with empty feed_url (negative)', () => {
    const db = freshDb();
    expect(() =>
      insertJournal(db, { name: 'x', fetcher_type: 'rss', feed_url: '', active: true } as any)
    ).toThrow();
  });
});

describe('articles CRUD', () => {
  it('articleExistsByDedupeKey is false for unknown, true after insert', () => {
    const db = freshDb();
    const j = insertJournal(db, {
      name: 'J',
      fetcher_type: 'rss',
      feed_url: 'https://j/f',
      active: true,
    });
    expect(articleExistsByDedupeKey(db, 'missing')).toBe(false);
    insertArticle(db, {
      journal_id: j.id,
      title: 'T',
      url: 'https://ex/a',
      doi: null,
      published_at: new Date().toISOString(),
      dedupe_key: 'dk-1',
    });
    expect(articleExistsByDedupeKey(db, 'dk-1')).toBe(true);
  });

  it('insertArticle rejects duplicate dedupe_key (negative)', () => {
    const db = freshDb();
    const j = insertJournal(db, {
      name: 'J',
      fetcher_type: 'rss',
      feed_url: 'https://j/f',
      active: true,
    });
    const base = {
      journal_id: j.id,
      title: 'T',
      url: 'https://ex/a',
      doi: null,
      published_at: new Date().toISOString(),
      dedupe_key: 'dup',
    };
    insertArticle(db, base);
    expect(() => insertArticle(db, base)).toThrow();
  });
});

describe('subscribers CRUD', () => {
  it('insertSubscriber + getActiveSubscribers round-trip', () => {
    const db = freshDb();
    const s = insertSubscriber(db, {
      channel_type: 'email',
      destination: 'u@example.com',
      active: true,
    });
    expect(s.id).toBeGreaterThan(0);
    expect(getActiveSubscribers(db).length).toBe(1);
  });

  it('rejects mismatched destination for channel_type (negative)', () => {
    const db = freshDb();
    expect(() =>
      insertSubscriber(db, {
        channel_type: 'email',
        destination: 'not-an-email',
        active: true,
      } as any)
    ).toThrow();
  });
});
