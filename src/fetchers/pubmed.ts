// PubMed fetcher stub — reserved for v2.
// PubMed E-utilities API: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi + efetch.fcgi

import type { Fetcher } from './index';
import type { Journal } from '../types/index';
import type { FetchResult } from '../types/index';
import type { AppConfig } from '../config';

export class PubmedFetcher implements Fetcher {
  async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
    return {
      journal_id: journal.id,
      articles: [],
      fetched_at: new Date().toISOString(),
      error: { kind: 'unknown', message: 'not implemented' },
    };
  }
}
