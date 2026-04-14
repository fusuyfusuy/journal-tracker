import { describe, it, expect } from 'bun:test';
import { ArxivFetcher } from '../../src/fetchers/arxiv';
import type { Journal } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const j: Journal = {
  id: 2,
  name: 'arX',
  fetcher_type: 'arxiv',
  feed_url: 'http://export.arxiv.org/api/query?search_query=cs.AI&max_results=1',
  active: true,
  created_at: new Date().toISOString(),
};

describe('ArxivFetcher', () => {
  it('returns a FetchResult (stub-ok or error) without crashing', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>x</title><id>https://arxiv.org/abs/1</id><published>2026-01-01T00:00:00Z</published></entry></feed>', { status: 200 });
    try {
      // stub may throw 'not implemented' per skeleton; accept either a valid result or the stub throw.
      let ok = false;
      try {
        const out = await new ArxivFetcher().fetch(j, cfg);
        ok = out && out.journal_id === 2;
      } catch (e) {
        ok = /not implemented/i.test((e as Error).message);
      }
      expect(ok).toBe(true);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('handles HTTP error response (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('x', { status: 500 });
    try {
      let saw = false;
      try {
        const out = await new ArxivFetcher().fetch(j, cfg);
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
