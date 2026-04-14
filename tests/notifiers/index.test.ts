import { describe, it, expect } from 'bun:test';
import { resolveNotifier, dispatchNotification } from '../../src/notifiers/index';
import type { Article, Subscriber } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const article: Article = {
  id: 1,
  journal_id: 1,
  title: 'T',
  url: 'https://ex.com/a/1',
  doi: null,
  published_at: new Date().toISOString(),
  dedupe_key: 'k-1',
  created_at: new Date().toISOString(),
};
const sub: Subscriber = {
  id: 1,
  channel_type: 'webhook',
  destination: 'https://hook.example.com',
  active: true,
  created_at: new Date().toISOString(),
};

describe('resolveNotifier', () => {
  it('returns email and webhook notifiers', () => {
    expect(typeof resolveNotifier('email').dispatch).toBe('function');
    expect(typeof resolveNotifier('webhook').dispatch).toBe('function');
  });

  it('throws for unknown channel (negative)', () => {
    expect(() => resolveNotifier('sms' as any)).toThrow();
  });
});

describe('dispatchNotification', () => {
  it('returns a NotificationEvent with status ok on 2xx', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('{}', { status: 200 });
    try {
      const ev = await dispatchNotification(article, sub, cfg);
      expect(ev.article_id).toBe(1);
      expect(ev.subscriber_id).toBe(1);
      expect(ev.status).toBe('ok');
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('returns a NotificationEvent with status error on 5xx (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('boom', { status: 500, statusText: 'ISE' });
    try {
      const ev = await dispatchNotification(article, sub, cfg);
      expect(ev.status).toBe('error');
      expect(typeof ev.error_message).toBe('string');
    } finally {
      (globalThis as any).fetch = orig;
    }
  });
});
