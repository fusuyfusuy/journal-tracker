import { Test } from '@nestjs/testing';
import { FETCHER_TOKEN, type Fetcher } from '@journal/shared';
import { FetchersService } from './fetchers.service';

const fake = (type: Fetcher['type']): Fetcher => ({
  type,
  async fetch() {
    return {
      journal_id: 0,
      articles: [],
      fetched_at: new Date().toISOString(),
      error: null,
    };
  },
});

describe('FetchersService', () => {
  let service: FetchersService;
  const rss = fake('rss');
  const arxiv = fake('arxiv');

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: FETCHER_TOKEN, useValue: [rss, arxiv] },
        FetchersService,
      ],
    }).compile();

    service = moduleRef.get(FetchersService);
  });

  it('resolves a registered fetcher by type', () => {
    expect(service.resolve('rss')).toBe(rss);
    expect(service.resolve('arxiv')).toBe(arxiv);
  });

  it('throws for an unknown type', () => {
    expect(() => service.resolve('crossref')).toThrow(/no fetcher registered/);
  });
});
