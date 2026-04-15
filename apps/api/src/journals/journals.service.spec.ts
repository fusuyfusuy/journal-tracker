import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Journal, Subscriber } from '@journal/database';
import { JournalsService } from './journals.service';

describe('JournalsService', () => {
  let moduleRef: TestingModule;
  let service: JournalsService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Journal, Article, Subscriber],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Journal]),
      ],
      providers: [JournalsService],
    }).compile();

    service = moduleRef.get(JournalsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates and lists journals', async () => {
    const created = await service.create({
      name: 'Nature',
      fetcher_type: 'rss',
      feed_url: 'https://nature.com/feed',
    });
    expect(created.id).toBeDefined();
    expect(created.active).toBe(true);

    const all = await service.list();
    expect(all).toHaveLength(1);
  });

  it('get() throws NotFoundException for unknown id', async () => {
    await expect(service.get(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates and deletes', async () => {
    const j = await service.create({
      name: 'x',
      fetcher_type: 'rss',
      feed_url: 'https://x/feed',
    });

    const updated = await service.update(j.id, { name: 'y', active: false });
    expect(updated.name).toBe('y');
    expect(updated.active).toBe(false);

    await service.remove(j.id);
    await expect(service.get(j.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
