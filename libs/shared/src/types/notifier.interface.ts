import type { Article, Subscriber } from '@journal/database';
import type { AppConfig } from '../config/app.config';

export type ChannelType = 'email' | 'webhook';

export interface NotificationEvent {
  article_id: number;
  subscriber_id: number;
  channel: ChannelType;
  status: 'ok' | 'error';
  dispatched_at: string;
  error?: { message: string; status?: number };
}

export interface Notifier {
  readonly channel: ChannelType;
  dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent>;
}

export const NOTIFIER_TOKEN = Symbol('NOTIFIER_TOKEN');
