import type { AppConfig } from '@journal/shared';
import type { Journal } from '@journal/database';
import { RssFetcher } from './rss.fetcher';

const journal: Journal = {
  id: 1,
  name: 'Example Feed',
  fetcher_type: 'rss',
  feed_url: 'https://example.org/feed.xml',
  active: true,
  created_at: new Date(),
};

const config = {
  userAgent: 'test-ua',
  checkIntervalMs: 3_600_000,
  dbPath: ':memory:',
  dbSynchronize: false,
  redis: { host: 'x', port: 6379 },
  resend: { apiKey: 'rk', from: 'from@example.com' },
  api: { port: 3000 },
} satisfies AppConfig;

describe('RssFetcher', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses RSS 2.0 with a single item', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        `<?xml version="1.0"?>
         <rss><channel>
           <item>
             <title>Hello</title>
             <link>https://example.org/a</link>
             <pubDate>Wed, 14 Apr 2026 00:00:00 GMT</pubDate>
             <guid>https://doi.org/10.1234/abcd</guid>
           </item>
         </channel></rss>`,
        { status: 200 },
      ),
    );

    const result = await new RssFetcher().fetch(journal, config);

    expect(result.error).toBeNull();
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toMatchObject({
      title: 'Hello',
      url: 'https://example.org/a',
      doi: '10.1234/abcd',
    });
    expect(Date.parse(result.articles[0].published_at)).not.toBeNaN();
  });

  it('parses Atom with multiple entries', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        `<?xml version="1.0"?>
         <feed xmlns="http://www.w3.org/2005/Atom">
           <entry><title>One</title><link href="https://e.org/1"/><updated>2026-04-14T00:00:00Z</updated></entry>
           <entry><title>Two</title><link href="https://e.org/2"/><updated>2026-04-14T00:00:00Z</updated></entry>
         </feed>`,
        { status: 200 },
      ),
    );

    const result = await new RssFetcher().fetch(journal, config);
    expect(result.error).toBeNull();
    expect(result.articles.map((a) => a.url)).toEqual(['https://e.org/1', 'https://e.org/2']);
  });

  it('returns an http error FetchResult on non-2xx', async () => {
    mockFetch.mockResolvedValue(new Response('nope', { status: 503, statusText: 'Service Unavailable' }));

    const result = await new RssFetcher().fetch(journal, config);
    expect(result.articles).toEqual([]);
    expect(result.error).toEqual({ kind: 'http', message: 'Service Unavailable', status: 503 });
  });

  it('returns a network error FetchResult when fetch throws', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('boom'), { name: 'TypeError' }));

    const result = await new RssFetcher().fetch(journal, config);
    expect(result.articles).toEqual([]);
    expect(result.error?.kind).toBe('network');
  });

  it('sends User-Agent and an AbortSignal', async () => {
    mockFetch.mockResolvedValue(
      new Response('<rss><channel></channel></rss>', { status: 200 }),
    );
    await new RssFetcher().fetch(journal, config);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['User-Agent']).toBe('test-ua');
    expect(init.signal).toBeDefined();
  });
});
