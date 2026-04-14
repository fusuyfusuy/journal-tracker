// RSS fetcher implementation using fast-xml-parser.
// Full implementation target (not a stub).

import { XMLParser } from 'fast-xml-parser';
import type { Fetcher } from './index';
import type { Journal } from '../types/index';
import type { FetchResult, NormalizedArticle } from '../types/index';
import type { AppConfig } from '../config';

export class RssFetcher implements Fetcher {
  /**
   * Fetch and parse an RSS/Atom feed for the given journal.
   */
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

      const rawItems = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
      const items = (Array.isArray(rawItems) ? rawItems : [rawItems]) as Array<Record<string, unknown>>;
      const articles: NormalizedArticle[] = [];

      for (const item of items) {
        const title = String(item.title ?? item.summary ?? '').trim();
        const link = item.link ?? item['@_href'] ?? '';
        const url: string =
          typeof link === 'string'
            ? link
            : String((link as Record<string, unknown>)?.['@_href'] ?? '');

        if (!title || !url) {
          continue;
        }

        let doi: string | null = null;
        if (item.guid && typeof item.guid === 'string' && item.guid.includes('doi')) {
          const doiMatch = item.guid.match(/\d+\.\d+\/[^\s]+/);
          if (doiMatch) {
            doi = doiMatch[0];
          }
        }
        if (!doi && item.link && typeof item.link === 'string' && item.link.includes('doi')) {
          const doiMatch = item.link.match(/\d+\.\d+\/[^\s]+/);
          if (doiMatch) {
            doi = doiMatch[0];
          }
        }

        const pubDate = item.pubDate ?? item.published ?? item.updated;
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

/**
 * Build a FetchResult carrying an error (no articles).
 */
export function buildErrorResult(
  journalId: number,
  error: { kind: string; message: string; status?: number }
): FetchResult {
  return {
    journal_id: journalId,
    articles: [],
    fetched_at: new Date().toISOString(),
    error: {
      kind: error.kind as any,
      message: error.message,
      status: error.status,
    },
  };
}
