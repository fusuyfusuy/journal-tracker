// Notifier interface + resolver registry.
// Maps Subscriber.channel_type to the appropriate Notifier implementation.

import type { Article, Subscriber } from '../types/index';
import type { NotificationEvent } from '../types/index';
import type { AppConfig } from '../config';
import { EmailNotifier } from './email';
import { WebhookNotifier } from './webhook';

/**
 * Pluggable notifier interface.
 * Each implementation receives an Article + Subscriber pair and returns a NotificationEvent.
 */
export interface Notifier {
  dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent>;
}

/**
 * Resolve the correct Notifier implementation for a given Subscriber.channel_type.
 */
export function resolveNotifier(channelType: Subscriber['channel_type']): Notifier {
  const registry: Record<Subscriber['channel_type'], Notifier> = {
    email: new EmailNotifier(),
    webhook: new WebhookNotifier(),
  };

  const notifier = registry[channelType];
  if (!notifier) {
    throw new Error(`Unknown channel type: ${channelType}`);
  }
  return notifier;
}

/**
 * Top-level dispatch action used by the cycle runner.
 * Resolves the notifier and calls dispatch().
 */
export async function dispatchNotification(
  article: Article,
  subscriber: Subscriber,
  config: AppConfig
): Promise<NotificationEvent> {
  try {
    const notifier = resolveNotifier(subscriber.channel_type);
    const event = await notifier.dispatch(article, subscriber, config);
    return event;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      article_id: article.id,
      subscriber_id: subscriber.id,
      channel: subscriber.channel_type,
      status: 'error',
      error_message: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}
