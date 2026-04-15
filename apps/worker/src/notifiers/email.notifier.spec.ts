import type { AppConfig } from '@journal/shared';
import type { Article, Subscriber } from '@journal/database';
import { EmailNotifier } from './email.notifier';

const article: Article = {
  id: 10,
  journal_id: 1,
  title: 'Title <special>',
  url: 'https://example.org/article',
  doi: '10.1/abc',
  published_at: new Date('2026-01-01T00:00:00Z'),
  dedupe_key: '10.1/abc',
  created_at: new Date(),
};

const subscriber: Subscriber = {
  id: 99,
  channel_type: 'email',
  destination: 'user@example.com',
  active: true,
  created_at: new Date(),
};

const config = {
  userAgent: 'test-ua',
  checkIntervalMs: 3_600_000,
  dbPath: ':memory:',
  dbSynchronize: false,
  redis: { host: 'x', port: 6379 },
  resend: { apiKey: 'rk_test', from: 'from@example.com' },
  api: { port: 3000 },
} satisfies AppConfig;

describe('EmailNotifier', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to Resend with bearer auth and escapes HTML', async () => {
    mockFetch.mockResolvedValue(new Response('{"id":"x"}', { status: 200 }));

    const event = await new EmailNotifier().dispatch(article, subscriber, config);

    expect(event.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer rk_test',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.to).toEqual(['user@example.com']);
    expect(body.subject).toBe('Title <special>');
    expect(body.html).toContain('Title &lt;special&gt;');
    expect(body.html).toContain('10.1/abc');
  });

  it('returns status=error on non-2xx', async () => {
    mockFetch.mockResolvedValue(new Response('rate limited', { status: 429 }));

    const event = await new EmailNotifier().dispatch(article, subscriber, config);

    expect(event.status).toBe('error');
    expect(event.error?.status).toBe(429);
  });

  it('returns status=error on fetch throw', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const event = await new EmailNotifier().dispatch(article, subscriber, config);
    expect(event.status).toBe('error');
    expect(event.error?.message).toMatch(/network down/);
  });
});
