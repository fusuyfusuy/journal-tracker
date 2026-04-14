// Crossref fetcher stub — reserved for v2.
// Crossref REST API: https://api.crossref.org/works?filter=container-title:<journal>&rows=20&sort=published&order=desc

import type { Fetcher } from './index';
import type { Journal } from '../types/index';
import type { FetchResult } from '../types/index';
import type { AppConfig } from '../config';

export class CrossrefFetcher implements Fetcher {
  async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
    // Crossref fetcher is reserved for v2.
    // Per Phase 0, this is a stub implementation.
    // Returns empty articles array with "not implemented" error.
    return {
      journal_id: journal.id,
      articles: [],
      fetched_at: new Date().toISOString(),
      error: {
        kind: 'unknown',
        message: 'not implemented',
      },
    };
  }
}
