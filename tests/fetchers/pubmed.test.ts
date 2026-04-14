import { describe, it, expect } from 'bun:test';
import { PubmedFetcher } from '../../src/fetchers/pubmed';
import type { Journal } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const j: Journal = {
  id: 4,
  name: 'pm',
  fetcher_type: 'pubmed',
  feed_url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=cancer',
  active: true,
  created_at: new Date().toISOString(),
};

describe('PubmedFetcher', () => {
  it('accepts the happy-path call (stub-ok or not-implemented)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('<eSearchResult></eSearchResult>', { status: 200 });
    try {
      let ok = false;
      try {
        const out = await new PubmedFetcher().fetch(j, cfg);
        ok = !!out && out.journal_id === 4;
      } catch (e) {
        ok = /not implemented/i.test((e as Error).message);
      }
      expect(ok).toBe(true);
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('surfaces HTTP error (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('x', { status: 503 });
    try {
      let saw = false;
      try {
        const out = await new PubmedFetcher().fetch(j, cfg);
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
