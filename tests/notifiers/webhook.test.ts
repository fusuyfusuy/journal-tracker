import { describe, it, expect } from 'bun:test';
import { WebhookNotifier } from '../../src/notifiers/webhook';
import type { Article, Subscriber } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua-test' };
const article: Article = {
  id: 7,
  journal_id: 2,
  title: 'W',
  url: 'https://ex.com/w',
  doi: null,
  published_at: new Date().toISOString(),
  dedupe_key: 'wk',
  created_at: new Date().toISOString(),
};
const sub: Subscriber = {
  id: 9,
  channel_type: 'webhook',
  destination: 'https://hook.example.com/in',
  active: true,
  created_at: new Date().toISOString(),
};

describe('WebhookNotifier', () => {
  it('POSTs JSON payload to subscriber.destination and returns ok', async () => {
    const orig = globalThis.fetch;
    let seenBody: any = null;
    (globalThis as any).fetch = async (url: string, init: any) => {
      expect(url).toBe(sub.destination);
      expect(init?.method).toBe('POST');
      seenBody = JSON.parse(init?.body ?? '{}');
      return new Response('{}', { status: 200 });
    };
    try {
      const ev = await new WebhookNotifier().dispatch(article, sub, cfg);
      expect(seenBody?.event).toBe('new_article');
      expect(seenBody?.article?.id).toBe(7);
      expect(ev.status).toBe('ok');
      expect(ev.channel).toBe('webhook');
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('returns error NotificationEvent on non-2xx (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('no', { status: 502, statusText: 'Bad Gateway' });
    try {
      const ev = await new WebhookNotifier().dispatch(article, sub, cfg);
      expect(ev.status).toBe('error');
      expect(ev.error_message).toContain('502');
    } finally {
      (globalThis as any).fetch = orig;
    }
  });
});
