import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Article, Subscriber } from '@journal/database';
import { AppConfig, NotificationEvent, StructuredLogger } from '@journal/shared';
import { ConfigService } from '@nestjs/config';
import { NOTIFY_QUEUE } from '../cycle/queue.constants';
import { NotifiersService } from './notifiers.service';

export interface NotifyJobData {
  article: Record<string, unknown>;
  subscriber: Record<string, unknown>;
}

function reviveArticle(raw: Record<string, unknown>): Article {
  const article = { ...raw } as unknown as Article;
  if (typeof raw.published_at === 'string') {
    article.published_at = new Date(raw.published_at);
  }
  if (typeof raw.created_at === 'string') {
    article.created_at = new Date(raw.created_at);
  }
  return article;
}

function reviveSubscriber(raw: Record<string, unknown>): Subscriber {
  const subscriber = { ...raw } as unknown as Subscriber;
  if (typeof raw.created_at === 'string') {
    subscriber.created_at = new Date(raw.created_at);
  }
  return subscriber;
}

@Processor(NOTIFY_QUEUE)
export class NotifyProcessor extends WorkerHost {
  constructor(
    private readonly notifiers: NotifiersService,
    private readonly config: ConfigService,
    private readonly log: StructuredLogger,
  ) {
    super();
  }

  async process(job: Job<NotifyJobData>): Promise<NotificationEvent> {
    const article = reviveArticle(job.data.article);
    const subscriber = reviveSubscriber(job.data.subscriber);
    const app = this.config.getOrThrow<AppConfig>('app');

    const notifier = this.notifiers.resolve(subscriber.channel_type);
    const event = await notifier.dispatch(article, subscriber, app);

    if (event.status === 'error') {
      const status = event.error?.status;
      if (status !== undefined && status >= 400 && status < 500) {
        throw new UnrecoverableError(
          `delivery failed with client error ${status}: ${event.error?.message ?? ''}`,
        );
      }
      throw new Error(`delivery failed: ${event.error?.message ?? 'unknown error'}`);
    }

    this.log.info('deliver.ok', {
      article_id: event.article_id,
      subscriber_id: event.subscriber_id,
      channel: event.channel,
    });

    return event;
  }
}
