import { Injectable } from '@nestjs/common';
import type { AppConfig, NotificationEvent, Notifier } from '@journal/shared';
import type { Article, Subscriber } from '@journal/database';

@Injectable()
export class EmailNotifier implements Notifier {
  readonly channel = 'email' as const;

  async dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent> {
    const body = {
      from: config.resend.from,
      to: [subscriber.destination],
      subject: article.title,
      html: this.renderHtml(article),
    };

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.resend.apiKey}`,
          'User-Agent': config.userAgent,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          article_id: article.id,
          subscriber_id: subscriber.id,
          channel: 'email',
          status: 'error',
          dispatched_at: new Date().toISOString(),
          error: { message: `resend ${res.status}: ${text.slice(0, 200)}`, status: res.status },
        };
      }

      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: 'email',
        status: 'ok',
        dispatched_at: new Date().toISOString(),
      };
    } catch (e) {
      const err = e as Error;
      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: 'email',
        status: 'error',
        dispatched_at: new Date().toISOString(),
        error: { message: err.message },
      };
    }
  }

  private renderHtml(a: Article): string {
    const doiLine = a.doi ? `<p>DOI: <a href="https://doi.org/${a.doi}">${a.doi}</a></p>` : '';
    return `<h2>${escape(a.title)}</h2>
<p>Published: ${a.published_at}</p>
<p><a href="${escape(a.url)}">${escape(a.url)}</a></p>
${doiLine}`;
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
