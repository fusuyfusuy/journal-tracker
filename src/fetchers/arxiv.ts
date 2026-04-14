// arXiv fetcher stub.
// arXiv exposes an Atom feed at http://export.arxiv.org/api/query?search_query=...&max_results=N
// Full implementation is out of scope for v1 — stub throws 'not implemented'.

import { XMLParser } from 'fast-xml-parser';
import type { Fetcher } from './index';
import type { Journal } from '../types/index';
import type { FetchResult, NormalizedArticle } from '../types/index';
import type { AppConfig } from '../config';
import { buildErrorResult } from './rss';

export class ArxivFetcher implements Fetcher {
  async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(journal.feed_url, {
        signal: controller.signal,
        headers: { 'User-Agent': config.userAgent },
      });

      if (!res.ok) {
        return buildErrorResult(journal.id, {
          kind: 'http',
          message: res.statusText,
          status: res.status,
        });
      }

      const xml = await res.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const parsed = parser.parse(xml);

      const rawEntries = parsed.feed?.entry ?? [];
      const entries = (Array.isArray(rawEntries) ? rawEntries : [rawEntries]) as Array<Record<string, unknown>>;
      const articles: NormalizedArticle[] = [];

      for (const entry of entries) {
        const title = String(entry.title ?? '').trim();
        const url = String(entry.id ?? '').trim();
        const doi = entry['arxiv:doi'] ? String(entry['arxiv:doi']).trim() : null;

        if (!title || !url) {
          continue;
        }

        const pubDate = entry.published;
        let published_at = new Date().toISOString();
        if (pubDate && typeof pubDate === 'string') {
          const date = new Date(pubDate);
          if (!isNaN(date.getTime())) {
            published_at = date.toISOString();
          }
        }

        articles.push({
          title,
          url,
          doi,
          published_at,
        });
      }

      return {
        journal_id: journal.id,
        articles,
        fetched_at: new Date().toISOString(),
        error: null,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
