import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfig, LoggingModule, StructuredLogger } from '@journal/shared';
import { UnrecoverableError } from 'bullmq';
import { NotifiersService } from './notifiers.service';
import { NotifyProcessor, NotifyJobData } from './notify.processor';

const testConfig = (): { app: AppConfig } => ({
  app: {
    userAgent: 'test-ua',
    checkIntervalMs: 3_600_000,
    dbPath: ':memory:',
    dbSynchronize: false,
    apiKeys: [],
    redis: { host: 'x', port: 6379 },
    resend: { apiKey: 'rk', from: 'from@example.com' },
    api: { port: 3000 },
  },
});

const makeJob = (data: NotifyJobData) =>
  ({
    id: 'test-job-1',
    name: 'deliver',
    data,
  }) as any;

const makeJobData = (): NotifyJobData => ({
  article: {
    id: 1,
    journal_id: 1,
    title: 'Test Article',
    url: 'https://example.org/article',
    doi: '10.1/test',
    published_at: '2026-01-01T00:00:00.000Z',
    dedupe_key: '10.1/test',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  subscriber: {
    id: 2,
    channel_type: 'email',
    destination: 'user@example.com',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
});

describe('NotifyProcessor', () => {
  let moduleRef: TestingModule;
  let processor: NotifyProcessor;
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
    dispatchMock.mockReset();

    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [testConfig] }), LoggingModule],
      providers: [
        NotifyProcessor,
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

    processor = moduleRef.get(NotifyProcessor);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('happy path: returns event when dispatch returns status ok', async () => {
    const event = {
      article_id: 1,
      subscriber_id: 2,
      channel: 'email',
      status: 'ok' as const,
      dispatched_at: new Date().toISOString(),
    };
    dispatchMock.mockResolvedValue(event);

    const result = await processor.process(makeJob(makeJobData()));

    expect(result).toEqual(event);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('retry path: throws regular Error on 5xx error so BullMQ retries', async () => {
    dispatchMock.mockResolvedValue({
      article_id: 1,
      subscriber_id: 2,
      channel: 'email',
      status: 'error' as const,
      dispatched_at: new Date().toISOString(),
      error: { message: 'Internal Server Error', status: 500 },
    });

    let thrownError: unknown;
    try {
      await processor.process(makeJob(makeJobData()));
    } catch (error) {
      thrownError = error;
    }
    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError).not.toBeInstanceOf(UnrecoverableError);
  });

  it('unrecoverable path: throws UnrecoverableError on 4xx error', async () => {
    dispatchMock.mockResolvedValue({
      article_id: 1,
      subscriber_id: 2,
      channel: 'email',
      status: 'error' as const,
      dispatched_at: new Date().toISOString(),
      error: { message: 'Bad Request', status: 400 },
    });

    await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow(UnrecoverableError);
  });

  it('unrecoverable path: throws UnrecoverableError on 422 error', async () => {
    dispatchMock.mockResolvedValue({
      article_id: 1,
      subscriber_id: 2,
      channel: 'email',
      status: 'error' as const,
      dispatched_at: new Date().toISOString(),
      error: { message: 'Unprocessable Entity', status: 422 },
    });

    await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow(UnrecoverableError);
  });

  it('propagates exception thrown by notifier dispatch', async () => {
    dispatchMock.mockRejectedValue(new Error('notifier exploded'));

    await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow('notifier exploded');
  });
});
