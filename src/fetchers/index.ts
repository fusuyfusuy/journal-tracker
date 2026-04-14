// Fetcher interface + resolver registry.
// Maps Journal.fetcher_type to the appropriate Fetcher implementation.

import type { Journal } from '../types/index';
import type { FetchResult, FetchError } from '../types/index';
import type { AppConfig } from '../config';
import { RssFetcher } from './rss';
import { ArxivFetcher } from './arxiv';
import { CrossrefFetcher } from './crossref';
import { PubmedFetcher } from './pubmed';
import { HtmlFetcher } from './html';

/**
 * Pluggable fetcher interface.
 * Each implementation receives a Journal and returns a FetchResult.
 */
export interface Fetcher {
  fetch(journal: Journal, config: AppConfig): Promise<FetchResult>;
}

/**
 * Resolve the correct Fetcher implementation for a given Journal.fetcher_type.
 * Returns the Fetcher instance from the registry.
 */
export function resolveFetcher(fetcherType: Journal['fetcher_type']): Fetcher {
  const registry: Record<Journal['fetcher_type'], Fetcher> = {
    rss: new RssFetcher(),
    arxiv: new ArxivFetcher(),
    crossref: new CrossrefFetcher(),
    pubmed: new PubmedFetcher(),
    html: new HtmlFetcher(),
  };

  const fetcher = registry[fetcherType];
  if (!fetcher) {
    throw new Error(`Unknown fetcher type: ${fetcherType}`);
  }
  return fetcher;
}

/**
 * Top-level fetch entry point used by the cycle runner.
 * Resolves the fetcher, calls fetch(), and returns the FetchResult.
 */
export async function fetchJournalArticles(journal: Journal, config: AppConfig): Promise<FetchResult> {
  try {
    const fetcher = resolveFetcher(journal.fetcher_type);
    const result = await fetcher.fetch(journal, config);
    return result;
  } catch (err) {
    const error: FetchError = {
      kind: err instanceof Error && err.message.includes('Unknown fetcher type') ? 'unknown_fetcher_type' : 'unknown',
      message: err instanceof Error ? err.message : String(err),
    };
    return {
      journal_id: journal.id,
      articles: [],
      fetched_at: new Date().toISOString(),
      error,
    };
  }
}
