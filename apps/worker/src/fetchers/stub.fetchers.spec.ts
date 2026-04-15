import type { Journal } from '@journal/database';
import { CrossrefFetcher, HtmlFetcher, PubmedFetcher } from './stub.fetchers';

const journal: Journal = {
  id: 1,
  name: 'n',
  fetcher_type: 'crossref',
  feed_url: 'x',
  active: true,
  created_at: new Date(),
};

describe.each([
  ['CrossrefFetcher', new CrossrefFetcher(), 'crossref'],
  ['PubmedFetcher', new PubmedFetcher(), 'pubmed'],
  ['HtmlFetcher', new HtmlFetcher(), 'html'],
] as const)('%s (stub)', (_name, fetcher, type) => {
  it(`has type "${type}"`, () => {
    expect(fetcher.type).toBe(type);
  });

  it('returns not-implemented error without throwing', async () => {
    const result = await fetcher.fetch(journal);
    expect(result.articles).toEqual([]);
    expect(result.error).toEqual({ kind: 'unknown', message: 'not implemented' });
  });
});
