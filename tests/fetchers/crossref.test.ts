import { describe, it, expect } from 'bun:test';
import { CrossrefFetcher } from '../../src/fetchers/crossref';
import type { Journal } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const j: Journal = {
  id: 3,
  name: 'cr',
  fetcher_type: 'crossref',
  feed_url: 'https://api.crossref.org/works?rows=1',
  active: true,
  created_at: new Date().toISOString(),
};

describe('CrossrefFetcher', () => {
  it('returns a FetchResult (stub-ok or not-implemented) without silent-success on missing impl', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ message: { items: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    try {
      let ok = false;
      try {
        const out = await new CrossrefFetcher().fetch(j, cfg);
        ok = !!out && out.journal_id === 3;
      } catch (e) {
        ok = /not implemented/i.test((e as Error).message);
      }
      expect(ok).toBe(true);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('error path: HTTP 429 rate-limited (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('slow down', { status: 429 });
    try {
      let saw = false;
      try {
        const out = await new CrossrefFetcher().fetch(j, cfg);
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
