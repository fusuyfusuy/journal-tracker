import { describe, it, expect } from 'bun:test';
import { EmailNotifier, renderEmailHtml } from '../../src/notifiers/email';
import type { Article, Subscriber } from '../../src/types/index';

const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
const article: Article = {
  id: 1,
  journal_id: 1,
  title: 'Greeting',
  url: 'https://ex.com/a/1',
  doi: '10.1/x',
  published_at: new Date().toISOString(),
  dedupe_key: 'k',
  created_at: new Date().toISOString(),
};
const sub: Subscriber = {
  id: 1,
  channel_type: 'email',
  destination: 'u@example.com',
  active: true,
  created_at: new Date().toISOString(),
};

describe('EmailNotifier', () => {
  it('POSTs to Resend and returns ok NotificationEvent on 200', async () => {
    const orig = globalThis.fetch;
    let seenUrl = '';
    (globalThis as any).fetch = async (url: string, init: any) => {
      seenUrl = String(url);
      expect(init?.method).toBe('POST');
      expect(init?.headers?.Authorization ?? init?.headers?.authorization).toContain('Bearer');
      return new Response('{}', { status: 200 });
    };
    try {
      const ev = await new EmailNotifier().dispatch(article, sub, cfg);
      expect(seenUrl).toContain('resend.com');
      expect(ev.status).toBe('ok');
      expect(ev.channel).toBe('email');
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('returns error NotificationEvent on 401 (negative)', async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response('nope', { status: 401, statusText: 'Unauthorized' });
    try {
      const ev = await new EmailNotifier().dispatch(article, sub, cfg);
      expect(ev.status).toBe('error');
    } finally {
      (globalThis as any).fetch = orig;
    }
  });
});

describe('renderEmailHtml', () => {
  it('includes title and URL in body', () => {
    const html = renderEmailHtml(article);
    expect(html).toContain('Greeting');
    expect(html).toContain('https://ex.com/a/1');
  });

  it('still returns a string for article with null doi (negative-ish)', () => {
    const a = { ...article, doi: null };
    expect(typeof renderEmailHtml(a)).toBe('string');
  });
});
