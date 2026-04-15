import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { AppConfig, Fetcher, FetchError, FetchResult, NormalizedArticle } from '@journal/shared';
import type { Journal } from '@journal/database';

const DOI_REGEX = /\d+\.\d+\/[^\s]+/;

@Injectable()
export class RssFetcher implements Fetcher {
  readonly type = 'rss' as const;

  async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
    try {
      const res = await fetch(journal.feed_url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': config.userAgent },
      });

      if (!res.ok) {
        return this.buildError(journal.id, {
          kind: 'http',
          message: res.statusText,
          status: res.status,
        });
      }

      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const parsed = parser.parse(xml);

      const raw = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
      const items = (Array.isArray(raw) ? raw : [raw]) as Array<Record<string, unknown>>;

      const articles: NormalizedArticle[] = [];
      for (const item of items) {
        const title = String(item.title ?? '').trim();
        const link = item.link ?? '';
        const url =
          typeof link === 'string'
            ? link
            : String((link as Record<string, unknown>)?.['@_href'] ?? '');

        if (!title || !url) continue;

        let doi: string | null = null;
        const guidOrLink = [item.guid, item.link].find(
          (v) => typeof v === 'string' && (v as string).includes('doi'),
        );
        if (typeof guidOrLink === 'string') {
          const m = guidOrLink.match(DOI_REGEX);
          if (m) doi = m[0];
        }

        const rawDate = item.pubDate ?? item.published ?? item.updated;
        let published_at = new Date().toISOString();
        if (typeof rawDate === 'string') {
          const d = new Date(rawDate);
          if (!Number.isNaN(d.getTime())) published_at = d.toISOString();
        }

        articles.push({ title, url, doi, published_at });
      }

      return {
        journal_id: journal.id,
        articles,
        fetched_at: new Date().toISOString(),
        error: null,
      };
    } catch (e) {
      const err = e as Error;
      return this.buildError(journal.id, {
        kind: err.name === 'TimeoutError' ? 'timeout' : 'network',
        message: err.message,
      });
    }
  }

  private buildError(journalId: number, error: FetchError): FetchResult {
    return {
      journal_id: journalId,
      articles: [],
      fetched_at: new Date().toISOString(),
      error,
    };
  }
}
