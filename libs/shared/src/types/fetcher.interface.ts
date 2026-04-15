import type { Journal } from '@journal/database';
import type { AppConfig } from '../config/app.config';

export type FetcherType = 'rss' | 'arxiv' | 'crossref' | 'pubmed' | 'html';

export interface NormalizedArticle {
  title: string;
  url: string;
  doi: string | null;
  published_at: string;
}

export interface FetchError {
  kind: 'http' | 'network' | 'parse' | 'timeout' | 'unknown';
  message: string;
  status?: number;
}

export interface FetchResult {
  journal_id: number;
  articles: NormalizedArticle[];
  fetched_at: string;
  error: FetchError | null;
}

export interface Fetcher {
  readonly type: FetcherType;
  fetch(journal: Journal, config: AppConfig): Promise<FetchResult>;
}

export const FETCHER_TOKEN = Symbol('FETCHER_TOKEN');
