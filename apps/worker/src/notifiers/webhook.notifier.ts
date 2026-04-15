import { Injectable } from '@nestjs/common';
import type { AppConfig, NotificationEvent, Notifier } from '@journal/shared';
import type { Article, Subscriber } from '@journal/database';

@Injectable()
export class WebhookNotifier implements Notifier {
  readonly channel = 'webhook' as const;

  async dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent> {
    const payload = {
      event: 'new_article',
      article: {
        id: article.id,
        journal_id: article.journal_id,
        title: article.title,
        url: article.url,
        doi: article.doi,
        published_at: article.published_at,
      },
      subscriber_id: subscriber.id,
      dispatched_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(subscriber.destination, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return {
          article_id: article.id,
          subscriber_id: subscriber.id,
          channel: 'webhook',
          status: 'error',
          dispatched_at: new Date().toISOString(),
          error: { message: `webhook ${res.status}`, status: res.status },
        };
      }

      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: 'webhook',
        status: 'ok',
        dispatched_at: new Date().toISOString(),
      };
    } catch (e) {
      const err = e as Error;
      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: 'webhook',
        status: 'error',
        dispatched_at: new Date().toISOString(),
        error: { message: err.message },
      };
    }
  }
}
