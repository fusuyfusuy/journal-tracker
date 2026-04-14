import { describe, it, expect } from 'bun:test';
import { initDb, insertJournal, insertSubscriber, insertArticle } from '../src/db';
import {
  loadActiveJournals,
  selectNextJournal,
  normalizeArticles,
  dedupeArticle,
  skipArticle,
  persistArticle,
  nextArticle,
  loadSubscribers,
  logDeliverOk,
  logJournalResult,
  logCycleSummary,
  handleFetchError,
  handleNotifyError,
  handleDbError,
  handleTimeout,
  logAndContinue,
  resetCycleState,
  runCycle,
} from '../src/cycle';
import type { FetchResult, NormalizedArticle, NotificationEvent, CycleSummary, JournalResult } from '../src/types/index';

function silent<T>(fn: () => T): T {
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as any).write = () => true;
  try {
    return fn();
  } finally {
    (process.stdout as any).write = orig;
  }
}

const now = () => new Date().toISOString();

const sampleNormalized = (): NormalizedArticle => ({
  title: 'Hello',
  url: 'https://ex.com/a/1',
  doi: '10.1234/abc',
  published_at: now(),
});

describe('loadActiveJournals', () => {
  it('returns only active journals', async () => {
    const db = initDb(':memory:');
    insertJournal(db, { name: 'A', fetcher_type: 'rss', feed_url: 'https://a/f', active: true });
    const out = await loadActiveJournals(db);
    expect(out.length).toBe(1);
  });

  it('returns empty array when db has no active journals (negative)', async () => {
    const db = initDb(':memory:');
    const out = await loadActiveJournals(db);
    expect(out).toEqual([]);
  });
});

describe('selectNextJournal', () => {
  it('returns the journal at index', () => {
    const db = initDb(':memory:');
    const j = insertJournal(db, { name: 'A', fetcher_type: 'rss', feed_url: 'https://a/f', active: true });
    expect(selectNextJournal([j], 0).id).toBe(j.id);
  });

  it('throws when index out of range (negative)', () => {
    expect(() => selectNextJournal([], 0)).toThrow();
  });
});

describe('normalizeArticles', () => {
  it('returns [] when FetchResult.error is non-null', () => {
    const fr: FetchResult = {
      journal_id: 1,
      articles: [],
      fetched_at: now(),
      error: { kind: 'http', message: 'boom', status: 500 },
    };
    expect(normalizeArticles(fr)).toEqual([]);
  });

  it('passes through valid articles', () => {
    const fr: FetchResult = {
      journal_id: 1,
      articles: [sampleNormalized()],
      fetched_at: now(),
      error: null,
    };
    expect(normalizeArticles(fr).length).toBe(1);
  });

  it('filters out invalid articles (negative)', () => {
    const fr: FetchResult = {
      journal_id: 1,
      articles: [{ title: '', url: 'not-a-url', doi: null, published_at: 'bad' } as any],
      fetched_at: now(),
      error: null,
    };
    expect(silent(() => normalizeArticles(fr))).toEqual([]);
  });
});

describe('dedupeArticle / skipArticle / persistArticle / nextArticle', () => {
  it('dedupeArticle returns false for new, true after persist', async () => {
    const db = initDb(':memory:');
    const j = insertJournal(db, { name: 'J', fetcher_type: 'rss', feed_url: 'https://j/f', active: true });
    const a = sampleNormalized();
    expect(dedupeArticle(db, a)).toBe(false);
    await persistArticle(db, a, j.id);
    expect(dedupeArticle(db, a)).toBe(true);
  });

  it('persistArticle rejects invalid article (negative)', async () => {
    const db = initDb(':memory:');
    const j = insertJournal(db, { name: 'J', fetcher_type: 'rss', feed_url: 'https://j/f', active: true });
    await expect(
      persistArticle(db, { title: '', url: 'x', doi: null, published_at: 'bad' } as any, j.id)
    ).rejects.toBeDefined();
  });

  it('skipArticle is a no-op returning undefined', () => {
    expect(silent(() => skipArticle(sampleNormalized()))).toBeUndefined();
  });

  it('nextArticle increments', () => {
    expect(nextArticle(0)).toBe(1);
    expect(nextArticle(7)).toBe(8);
  });
});

describe('loadSubscribers', () => {
  it('returns active subscribers', async () => {
    const db = initDb(':memory:');
    insertSubscriber(db, { channel_type: 'email', destination: 'u@ex.com', active: true });
    const subs = await loadSubscribers(db);
    expect(subs.length).toBe(1);
  });

  it('returns [] when none active (negative)', async () => {
    const db = initDb(':memory:');
    expect(await loadSubscribers(db)).toEqual([]);
  });
});

describe('log-only actions emit without throwing', () => {
  const ev: NotificationEvent = {
    article_id: 1,
    subscriber_id: 1,
    channel: 'email',
    status: 'ok',
    error_message: null,
    timestamp: now(),
  };
  const jr: JournalResult = {
    journal_id: 1,
    journal_name: 'J',
    fetched: 0,
    new_articles: 0,
    errors: 0,
  };
  const cs: CycleSummary = {
    started_at: now(),
    finished_at: now(),
    journals_processed: 0,
    articles_new: 0,
    errors: 0,
  };

  it('logDeliverOk', () => {
    silent(() => expect(() => logDeliverOk(ev)).not.toThrow());
  });
  it('logJournalResult', () => {
    silent(() => expect(() => logJournalResult(jr)).not.toThrow());
  });
  it('logCycleSummary', () => {
    silent(() => expect(() => logCycleSummary(cs)).not.toThrow());
  });
  it('handleFetchError (error-path)', () => {
    silent(() => expect(() => handleFetchError(new Error('boom'), 1)).not.toThrow());
  });
  it('handleNotifyError (error-path)', () => {
    silent(() => expect(() => handleNotifyError(new Error('boom'), 1, 1)).not.toThrow());
  });
  it('handleDbError (error-path)', () => {
    silent(() => expect(() => handleDbError(new Error('boom'), 'ctx')).not.toThrow());
  });
  it('handleTimeout (timeout handler — synthetic input, not real fake timers)', () => {
    // NOTE: We assert shape behavior on a synthetic timeout context rather
    // than using fake timers. Bun's timer control is limited; this is the
    // agreed-upon substitute per Phase 3 brief.
    silent(() => expect(() => handleTimeout('fetching_journal')).not.toThrow());
  });
  it('logAndContinue', () => {
    silent(() => expect(() => logAndContinue('ctx', 'because')).not.toThrow());
  });
  it('resetCycleState', () => {
    silent(() => expect(() => resetCycleState()).not.toThrow());
  });

  it('handleFetchError negative-case: accepts Error with empty message', () => {
    silent(() => expect(() => handleFetchError(new Error(''), 0)).not.toThrow());
  });
});

describe('runCycle', () => {
  it('runs a cycle with no journals and returns a CycleSummary', async () => {
    const db = initDb(':memory:');
    const cfg = {
      checkIntervalMs: 3_600_000,
      resendApiKey: 'rk',
      dbPath: ':memory:',
      userAgent: 'ua',
    };
    const summary = await silent(() => runCycle(db, cfg));
    const s = await summary;
    expect(s.journals_processed).toBe(0);
    expect(s.articles_new).toBe(0);
  });
});
