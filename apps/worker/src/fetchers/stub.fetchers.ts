import { Injectable } from '@nestjs/common';
import type { Fetcher, FetchResult } from '@journal/shared';
import type { Journal } from '@journal/database';

const notImplemented = (journalId: number): FetchResult => ({
  journal_id: journalId,
  articles: [],
  fetched_at: new Date().toISOString(),
  error: { kind: 'unknown', message: 'not implemented' },
});

@Injectable()
export class CrossrefFetcher implements Fetcher {
  readonly type = 'crossref' as const;
  async fetch(journal: Journal): Promise<FetchResult> {
    return notImplemented(journal.id);
  }
}

@Injectable()
export class PubmedFetcher implements Fetcher {
  readonly type = 'pubmed' as const;
  async fetch(journal: Journal): Promise<FetchResult> {
    return notImplemented(journal.id);
  }
}

@Injectable()
export class HtmlFetcher implements Fetcher {
  readonly type = 'html' as const;
  async fetch(journal: Journal): Promise<FetchResult> {
    return notImplemented(journal.id);
  }
}
