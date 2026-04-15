import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { AppConfig, Fetcher, FetchResult, NormalizedArticle } from '@journal/shared';
import type { Journal } from '@journal/database';

@Injectable()
export class ArxivFetcher implements Fetcher {
  readonly type = 'arxiv' as const;

  async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
    try {
      const res = await fetch(journal.feed_url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': config.userAgent },
      });

      if (!res.ok) {
        return {
          journal_id: journal.id,
          articles: [],
          fetched_at: new Date().toISOString(),
          error: { kind: 'http', message: res.statusText, status: res.status },
        };
      }

      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const parsed = parser.parse(xml);
      const raw = parsed?.feed?.entry ?? [];
      const entries = (Array.isArray(raw) ? raw : [raw]) as Array<Record<string, unknown>>;

      const articles: NormalizedArticle[] = [];
      for (const e of entries) {
        const title = String(e.title ?? '').trim();
        const url = String(e.id ?? '').trim();
        if (!title || !url) continue;
        const doi = e['arxiv:doi'] ? String(e['arxiv:doi']).trim() : null;
        const pub = e.published;
        let published_at = new Date().toISOString();
        if (typeof pub === 'string') {
          const d = new Date(pub);
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
      return {
        journal_id: journal.id,
        articles: [],
        fetched_at: new Date().toISOString(),
        error: { kind: err.name === 'TimeoutError' ? 'timeout' : 'network', message: err.message },
      };
    }
  }
}
