import type { AppConfig } from '@journal/shared';
import type { Article, Subscriber } from '@journal/database';
import { WebhookNotifier } from './webhook.notifier';

const article: Article = {
  id: 5,
  journal_id: 1,
  title: 'A',
  url: 'https://example.org/a',
  doi: null,
  published_at: new Date('2026-01-01T00:00:00Z'),
  dedupe_key: 'https://example.org/a',
  created_at: new Date(),
};

const subscriber: Subscriber = {
  id: 7,
  channel_type: 'webhook',
  destination: 'https://hooks.example.net/ingest',
  active: true,
  created_at: new Date(),
};

const config = {
  userAgent: 'test-ua',
  checkIntervalMs: 3_600_000,
  dbPath: ':memory:',
  dbSynchronize: false,
  apiKeys: [],
  redis: { host: 'x', port: 6379 },
  resend: { apiKey: 'rk', from: 'from@example.com' },
  api: { port: 3000 },
} satisfies AppConfig;

describe('WebhookNotifier', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs JSON to subscriber.destination', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const event = await new WebhookNotifier().dispatch(article, subscriber, config);

    expect(event.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.net/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      event: 'new_article',
      subscriber_id: 7,
      article: { id: 5, title: 'A', url: 'https://example.org/a' },
    });
  });

  it('returns status=error on non-2xx', async () => {
    mockFetch.mockResolvedValue(new Response('boom', { status: 500 }));
    const event = await new WebhookNotifier().dispatch(article, subscriber, config);
    expect(event.status).toBe('error');
    expect(event.error?.status).toBe(500);
  });
});
