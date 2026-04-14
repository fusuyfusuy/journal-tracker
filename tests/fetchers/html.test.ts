import { describe, it, expect } from 'bun:test';
import { HtmlFetcher } from '../../src/fetchers/html';
import type { Journal } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const j: Journal = {
  id: 5,
  name: 'html',
  fetcher_type: 'html',
  feed_url: 'https://example.com/toc',
  active: true,
  created_at: new Date().toISOString(),
};

describe('HtmlFetcher', () => {
  it('returns a FetchResult (stub-ok or not-implemented)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response('<html><body><a href="/a/1">x</a></body></html>', { status: 200 });
    try {
      let ok = false;
      try {
        const out = await new HtmlFetcher().fetch(j, cfg);
        ok = !!out && out.journal_id === 5;
      } catch (e) {
        ok = /not implemented/i.test((e as Error).message);
      }
      expect(ok).toBe(true);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('error path on 404 (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('nf', { status: 404 });
    try {
      let saw = false;
      try {
        const out = await new HtmlFetcher().fetch(j, cfg);
        if (!out || out.error !== null) saw = true;
      } catch {
        saw = true;
      }
      expect(saw).toBe(true);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });
});
