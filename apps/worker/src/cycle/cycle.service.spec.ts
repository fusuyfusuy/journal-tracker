import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Journal, Subscriber } from '@journal/database';
import { AppConfig, LoggingModule, StructuredLogger } from '@journal/shared';
import { Repository } from 'typeorm';
import { FetchersService } from '../fetchers/fetchers.service';
import { NotifiersService } from '../notifiers/notifiers.service';
import { CycleService } from './cycle.service';

const testConfig = (): { app: AppConfig } => ({
  app: {
    userAgent: 'test-ua',
    checkIntervalMs: 3_600_000,
    dbPath: ':memory:',
    redis: { host: 'x', port: 6379 },
    resend: { apiKey: 'rk', from: 'from@example.com' },
    api: { port: 3000 },
  },
});

describe('CycleService', () => {
  let moduleRef: TestingModule;
  let service: CycleService;
  let journalRepo: Repository<Journal>;
  let articleRepo: Repository<Article>;
  let subscriberRepo: Repository<Subscriber>;

  const fetchMock = jest.fn();
  const dispatchMock = jest.fn();
  const silentLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    verbose: jest.fn(),
  } as unknown as StructuredLogger;

  beforeEach(async () => {
    fetchMock.mockReset();
    dispatchMock.mockReset();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [testConfig] }),
        LoggingModule,
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Journal, Article, Subscriber],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Journal, Article, Subscriber]),
      ],
      providers: [
        CycleService,
        {
          provide: FetchersService,
          useValue: {
            resolve: () => ({ type: 'rss', fetch: fetchMock }),
          },
        },
        {
          provide: NotifiersService,
          useValue: {
            resolve: () => ({ channel: 'email', dispatch: dispatchMock }),
          },
        },
      ],
    })
      .overrideProvider(StructuredLogger)
      .useValue(silentLogger)
      .compile();

    service = moduleRef.get(CycleService);
    journalRepo = moduleRef.get('JournalRepository');
    articleRepo = moduleRef.get('ArticleRepository');
    subscriberRepo = moduleRef.get('SubscriberRepository');
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const seedJournal = async (): Promise<Journal> =>
    journalRepo.save(
      journalRepo.create({
        name: 'Test',
        fetcher_type: 'rss',
        feed_url: 'https://example.org/feed',
        active: true,
      }),
    );

  const seedSubscriber = async (): Promise<Subscriber> =>
    subscriberRepo.save(
      subscriberRepo.create({
        channel_type: 'email',
        destination: 'u@example.com',
        active: true,
      }),
    );

  const fetchOk = (articles: Array<{ title: string; url: string; doi?: string | null }>) => ({
    journal_id: 1,
    articles: articles.map((a) => ({
      title: a.title,
      url: a.url,
      doi: a.doi ?? null,
      published_at: '2026-01-01T00:00:00.000Z',
    })),
    fetched_at: new Date().toISOString(),
    error: null,
  });

  it('persists new articles and dispatches to each subscriber', async () => {
    await seedJournal();
    await seedSubscriber();
    await seedSubscriber();

    fetchMock.mockResolvedValue(
      fetchOk([
        { title: 'A', url: 'https://ex.org/a', doi: '10.1/a' },
        { title: 'B', url: 'https://ex.org/b' },
      ]),
    );
    dispatchMock.mockResolvedValue({
      article_id: 0,
      subscriber_id: 0,
      channel: 'email',
      status: 'ok',
      dispatched_at: new Date().toISOString(),
    });

    const summary = await service.run();

    expect(summary.articles_new).toBe(2);
    expect(summary.errors).toBe(0);
    expect(await articleRepo.count()).toBe(2);
    expect(dispatchMock).toHaveBeenCalledTimes(4); // 2 articles × 2 subscribers
  });

  it('dedupes articles by DOI (DOI preferred over URL)', async () => {
    await seedJournal();
    await seedSubscriber();

    dispatchMock.mockResolvedValue({
      article_id: 0,
      subscriber_id: 0,
      channel: 'email',
      status: 'ok',
      dispatched_at: new Date().toISOString(),
    });

    fetchMock.mockResolvedValueOnce(fetchOk([{ title: 'A', url: 'https://ex.org/a', doi: '10.1/dup' }]));
    await service.run();

    // Same DOI, different URL — should still dedupe
    fetchMock.mockResolvedValueOnce(fetchOk([{ title: 'A2', url: 'https://ex.org/a-mirror', doi: '10.1/dup' }]));
    const second = await service.run();

    expect(second.articles_new).toBe(0);
    expect(await articleRepo.count()).toBe(1);
  });

  it('per-journal fault isolation — one fetcher failure does not stop others', async () => {
    const j1 = await seedJournal();
    const j2 = await journalRepo.save(
      journalRepo.create({
        name: 'J2',
        fetcher_type: 'rss',
        feed_url: 'https://example.org/feed2',
        active: true,
      }),
    );
    await seedSubscriber();

    fetchMock.mockImplementation(async (journal: Journal) => {
      if (journal.id === j1.id) throw new Error('feed exploded');
      return fetchOk([{ title: 'from-j2', url: 'https://ex.org/j2' }]);
    });
    dispatchMock.mockResolvedValue({
      article_id: 0,
      subscriber_id: 0,
      channel: 'email',
      status: 'ok',
      dispatched_at: new Date().toISOString(),
    });

    const summary = await service.run();

    expect(summary.journals_processed).toBe(2);
    expect(summary.articles_new).toBe(1);
    expect(summary.errors).toBeGreaterThanOrEqual(1);
    expect(await articleRepo.count()).toBe(1);
    void j2;
  });

  it('counts fetch errors (error field non-null) without persisting articles', async () => {
    await seedJournal();
    await seedSubscriber();

    fetchMock.mockResolvedValue({
      journal_id: 1,
      articles: [],
      fetched_at: new Date().toISOString(),
      error: { kind: 'http', message: '503', status: 503 },
    });

    const summary = await service.run();
    expect(summary.articles_new).toBe(0);
    expect(summary.errors).toBe(1);
    expect(await articleRepo.count()).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('continues when a notifier throws', async () => {
    await seedJournal();
    await seedSubscriber();

    fetchMock.mockResolvedValue(fetchOk([{ title: 'A', url: 'https://ex.org/a' }]));
    dispatchMock.mockRejectedValue(new Error('notifier boom'));

    const summary = await service.run();

    // Article still persisted; notifier exception is logged, not fatal.
    expect(summary.articles_new).toBe(1);
    expect(await articleRepo.count()).toBe(1);
  });
});
