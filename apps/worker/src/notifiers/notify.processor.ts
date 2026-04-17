import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Article, Subscriber } from '@journal/database';
import {
  AppConfig,
  NOTIFY_QUEUE,
  NotificationEvent,
  NotifyJobData,
  StructuredLogger,
} from '@journal/shared';
import { ConfigService } from '@nestjs/config';
import { NotifiersService } from './notifiers.service';

export type { NotifyJobData };

function reviveArticle(raw: NotifyJobData['article']): Article {
  const article = new Article();
  article.id = raw.id;
  article.journal_id = raw.journal_id;
  article.title = raw.title;
  article.url = raw.url;
  article.doi = raw.doi;
  article.published_at = new Date(raw.published_at);
  article.dedupe_key = raw.dedupe_key;
  article.created_at = new Date(raw.created_at);
  return article;
}

function reviveSubscriber(raw: NotifyJobData['subscriber']): Subscriber {
  const subscriber = new Subscriber();
  subscriber.id = raw.id;
  subscriber.channel_type = raw.channel_type;
  subscriber.destination = raw.destination;
  subscriber.active = raw.active;
  subscriber.created_at = new Date(raw.created_at);
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

    let notifier;
    try {
      notifier = this.notifiers.resolve(subscriber.channel_type);
    } catch (e) {
      throw new UnrecoverableError(
        `unknown channel "${subscriber.channel_type}": ${(e as Error).message}`,
      );
    }
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
