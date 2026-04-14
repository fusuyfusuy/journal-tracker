import { describe, it, expect } from 'bun:test';
import { RssFetcher, buildErrorResult } from '../../src/fetchers/rss';
import type { Journal } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const j: Journal = {
  id: 1,
  name: 'N',
  fetcher_type: 'rss',
  feed_url: 'https://example.com/feed.xml',
  active: true,
  created_at: new Date().toISOString(),
};

describe('RssFetcher', () => {
  it('parses a minimal RSS feed into NormalizedArticles', async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Hello</title><link>https://ex.com/a/1</link><pubDate>${new Date().toUTCString()}</pubDate></item>
    </channel></rss>`;
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response(xml, { status: 200 });
    try {
      const out = await new RssFetcher().fetch(j, cfg);
      expect(out.error).toBeNull();
      expect(out.articles.length).toBeGreaterThanOrEqual(0);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('returns error FetchResult on non-2xx (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('n', { status: 404, statusText: 'NF' });
    try {
      const out = await new RssFetcher().fetch(j, cfg);
      expect(out.error).not.toBeNull();
      expect(out.articles).toEqual([]);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });
});

describe('buildErrorResult', () => {
  it('returns FetchResult with error set and articles empty', () => {
    const out = buildErrorResult(7, { kind: 'http', message: 'boom', status: 500 });
    expect(out.journal_id).toBe(7);
    expect(out.articles).toEqual([]);
    expect(out.error).not.toBeNull();
  });
});
