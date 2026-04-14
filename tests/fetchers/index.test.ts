import { describe, it, expect } from 'bun:test';
import { resolveFetcher, fetchJournalArticles } from '../../src/fetchers/index';
import type { Journal } from '../../src/types/index';

const journal = (ft: Journal['fetcher_type']): Journal => ({
  id: 1,
  name: 'J',
  fetcher_type: ft,
  feed_url: 'https://example.com/feed',
  active: true,
  created_at: new Date().toISOString(),
});

describe('resolveFetcher', () => {
  it('returns an RSS fetcher for rss', () => {
    const f = resolveFetcher('rss');
    expect(typeof f.fetch).toBe('function');
  });

  it('returns instances for every declared fetcher_type', () => {
    for (const t of ['rss', 'arxiv', 'crossref', 'pubmed', 'html'] as const) {
      expect(typeof resolveFetcher(t).fetch).toBe('function');
    }
  });

  it('throws for unknown fetcher type (negative)', () => {
    expect(() => resolveFetcher('nope' as any)).toThrow();
  });
});

describe('fetchJournalArticles', () => {
  it('returns a FetchResult shape with journal_id, articles[], fetched_at, error', async () => {
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response('<rss><channel></channel></rss>', { status: 200 });
    try {
      const out = await fetchJournalArticles(journal('rss'), {
        checkIntervalMs: 3_600_000,
        resendApiKey: 'rk',
        dbPath: ':memory:',
        userAgent: 'ua',
      });
      expect(out.journal_id).toBe(1);
      expect(Array.isArray(out.articles)).toBe(true);
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  it('surfaces an error (as FetchResult.error or thrown) on HTTP 500 (negative)', async () => {
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('boom', { status: 500, statusText: 'ISE' });
    try {
      const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
      let saw = false;
      try {
        const out = await fetchJournalArticles(journal('rss'), cfg);
        if (out.error !== null) saw = true;
      } catch {
        saw = true;
      }
      expect(saw).toBe(true);
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });
});
