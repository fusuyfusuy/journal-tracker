// Generic HTTP POST JSON webhook notifier.

import type { Notifier } from './index';
import type { Article, Subscriber } from '../types/index';
import type { NotificationEvent } from '../types/index';
import type { AppConfig } from '../config';

export interface WebhookPayload {
  event: 'new_article';
  article: {
    id: number;
    title: string;
    url: string;
    doi: string | null;
    published_at: string;
    journal_id: number;
  };
  timestamp: string;
}

export class WebhookNotifier implements Notifier {
  async dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent> {
    const timestamp = new Date().toISOString();

    const payload: WebhookPayload = {
      event: 'new_article',
      article: {
        id: article.id,
        title: article.title,
        url: article.url,
        doi: article.doi,
        published_at: article.published_at,
        journal_id: article.journal_id,
      },
      timestamp,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(subscriber.destination, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          article_id: article.id,
          subscriber_id: subscriber.id,
          channel: subscriber.channel_type,
          status: 'error',
          error_message: `HTTP ${res.status}: ${res.statusText}`,
          timestamp,
        };
      }

      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: subscriber.channel_type,
        status: 'ok',
        error_message: null,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: subscriber.channel_type,
        status: 'error',
        error_message: errorMessage,
        timestamp,
      };
    }
  }
}
