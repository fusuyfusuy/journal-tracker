import type { AppConfig } from '@journal/shared';
import type { Journal } from '@journal/database';
import { ArxivFetcher } from './arxiv.fetcher';

const journal: Journal = {
  id: 2,
  name: 'arXiv',
  fetcher_type: 'arxiv',
  feed_url: 'https://export.arxiv.org/api/query?search_query=cs.AI',
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

describe('ArxivFetcher', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses a single-entry atom feed', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        `<feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Paper</title>
            <id>https://arxiv.org/abs/1</id>
            <published>2026-01-01T00:00:00Z</published>
          </entry>
        </feed>`,
        { status: 200 },
      ),
    );

    const result = await new ArxivFetcher().fetch(journal, config);
    expect(result.error).toBeNull();
    expect(result.articles).toEqual([
      {
        title: 'Paper',
        url: 'https://arxiv.org/abs/1',
        doi: null,
        published_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('surfaces http errors without throwing', async () => {
    mockFetch.mockResolvedValue(new Response('x', { status: 500, statusText: 'oops' }));
    const result = await new ArxivFetcher().fetch(journal, config);
    expect(result.error).toEqual({ kind: 'http', message: 'oops', status: 500 });
  });
});
