import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Article, Journal, Subscriber } from '@journal/database';
import {
  AppConfig,
  CycleSummary,
  FetchResult,
  JournalResult,
  NormalizedArticle,
  StructuredLogger,
} from '@journal/shared';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { FetchersService } from '../fetchers/fetchers.service';
import { NOTIFY_JOB, NOTIFY_JOB_OPTS, NOTIFY_QUEUE } from './queue.constants';

@Injectable()
export class CycleService {
  constructor(
    private readonly config: ConfigService,
    private readonly fetchers: FetchersService,
    private readonly log: StructuredLogger,
    @InjectQueue(NOTIFY_QUEUE) private readonly notifyQueue: Queue,
    @InjectRepository(Journal) private readonly journalRepo: Repository<Journal>,
    @InjectRepository(Article) private readonly articleRepo: Repository<Article>,
    @InjectRepository(Subscriber) private readonly subscriberRepo: Repository<Subscriber>,
  ) {}

  async run(): Promise<CycleSummary> {
    const app = this.config.getOrThrow<AppConfig>('app');
    const started_at = new Date().toISOString();
    const journals = await this.journalRepo.findBy({ active: true });
    const subscribers = await this.subscriberRepo.findBy({ active: true });

    const results: JournalResult[] = [];
    let articlesNew = 0;
    let totalErrors = 0;

    for (const journal of journals) {
      const result = await this.processJournal(journal, subscribers, app);
      results.push(result);
      articlesNew += result.new_articles;
      totalErrors += result.errors;
    }

    const summary: CycleSummary = {
      started_at,
      finished_at: new Date().toISOString(),
      journals_processed: journals.length,
      articles_new: articlesNew,
      errors: totalErrors,
      journals: results,
    };

    this.log.info('cycle.done', { ...summary });
    return summary;
  }

  private async processJournal(
    journal: Journal,
    subscribers: Subscriber[],
    app: AppConfig,
  ): Promise<JournalResult> {
    const result: JournalResult = {
      journal_id: journal.id,
      new_articles: 0,
      skipped: 0,
      errors: 0,
    };

    let fetchResult: FetchResult;
    try {
      const fetcher = this.fetchers.resolve(journal.fetcher_type);
      fetchResult = await fetcher.fetch(journal, app);
    } catch (e) {
      this.log.error('fetch.error', { journal_id: journal.id, message: (e as Error).message });
      result.errors += 1;
      return result;
    }

    if (fetchResult.error) {
      this.log.warn('fetch.failed', { journal_id: journal.id, error: fetchResult.error });
      result.errors += 1;
      return result;
    }

    for (const article of fetchResult.articles) {
      const processed = await this.processArticle(article, journal, subscribers, app);
      if (processed === 'new') result.new_articles += 1;
      else if (processed === 'skipped') result.skipped += 1;
      else result.errors += 1;
    }

    this.log.info('journal.processed', { ...result });
    return result;
  }

  private async processArticle(
    article: NormalizedArticle,
    journal: Journal,
    subscribers: Subscriber[],
    _app: AppConfig,
  ): Promise<'new' | 'skipped' | 'error'> {
    const dedupe_key = article.doi ?? article.url;
    try {
      const existing = await this.articleRepo.findOne({ where: { dedupe_key } });
      if (existing) {
        this.log.debug('article.skip', { dedupe_key, title: article.title });
        return 'skipped';
      }
    } catch (e) {
      this.log.error('db.error', { kind: 'dedupe_check', message: (e as Error).message });
      return 'error';
    }

    let saved: Article;
    try {
      saved = await this.articleRepo.save(
        this.articleRepo.create({
          journal_id: journal.id,
          title: article.title,
          url: article.url,
          doi: article.doi,
          published_at: new Date(article.published_at),
          dedupe_key,
        }),
      );
    } catch (e) {
      this.log.error('db.error', { kind: 'insert', message: (e as Error).message });
      return 'error';
    }

    for (const subscriber of subscribers) {
      await this.notifyQueue.add(
        NOTIFY_JOB,
        { article: { ...saved, published_at: saved.published_at.toISOString(), created_at: saved.created_at.toISOString() }, subscriber: { ...subscriber, created_at: subscriber.created_at.toISOString() } },
        NOTIFY_JOB_OPTS,
      );
    }

    return 'new';
  }
}
