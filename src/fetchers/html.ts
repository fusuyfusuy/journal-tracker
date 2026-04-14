// HTML scraping fetcher stub — reserved for v2.
// Scrapes a journal ToC page and extracts article links via CSS selectors stored in feed_url fragment or a config column.

import type { Fetcher } from './index';
import type { Journal } from '../types/index';
import type { FetchResult } from '../types/index';
import type { AppConfig } from '../config';

export class HtmlFetcher implements Fetcher {
  async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
    return {
      journal_id: journal.id,
      articles: [],
      fetched_at: new Date().toISOString(),
      error: { kind: 'unknown', message: 'not implemented' },
    };
  }
}
