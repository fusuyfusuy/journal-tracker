import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Journal, Subscriber } from '@journal/database';
import request from 'supertest';
import { JournalsModule } from '../src/journals/journals.module';
import { SubscribersModule } from '../src/subscribers/subscribers.module';

describe('API (journals + subscribers) — e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Journal, Article, Subscriber],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Journal, Subscriber]),
        JournalsModule,
        SubscribersModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /journals', () => {
    it('creates a journal', async () => {
      const res = await request(app.getHttpServer())
        .post('/journals')
        .send({ name: 'Nature', fetcher_type: 'rss', feed_url: 'https://nature.com/feed' })
        .expect(201);
      expect(res.body).toMatchObject({ name: 'Nature', fetcher_type: 'rss', active: true });
      expect(res.body.id).toBeDefined();
    });

    it('rejects invalid fetcher_type', async () => {
      await request(app.getHttpServer())
        .post('/journals')
        .send({ name: 'X', fetcher_type: 'bogus', feed_url: 'https://x/feed' })
        .expect(400);
    });

    it('rejects missing required fields', async () => {
      await request(app.getHttpServer()).post('/journals').send({ name: 'only' }).expect(400);
    });
  });

  describe('GET /journals', () => {
    it('returns all journals', async () => {
      await request(app.getHttpServer())
        .post('/journals')
        .send({ name: 'J1', fetcher_type: 'rss', feed_url: 'https://j1/feed' });

      const res = await request(app.getHttpServer()).get('/journals').expect(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PATCH/DELETE /journals/:id', () => {
    it('updates and then deletes', async () => {
      const created = await request(app.getHttpServer())
        .post('/journals')
        .send({ name: 'A', fetcher_type: 'rss', feed_url: 'https://a/f' });

      await request(app.getHttpServer())
        .patch(`/journals/${created.body.id}`)
        .send({ active: false })
        .expect(200)
        .then((r) => expect(r.body.active).toBe(false));

      await request(app.getHttpServer()).delete(`/journals/${created.body.id}`).expect(204);
      await request(app.getHttpServer()).get(`/journals/${created.body.id}`).expect(404);
    });
  });

  describe('POST /subscribers', () => {
    it('creates an email subscriber', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .send({ channel_type: 'email', destination: 'u@example.com' })
        .expect(201);
    });

    it('rejects an email subscriber with non-email destination', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .send({ channel_type: 'email', destination: 'nope' })
        .expect(400);
    });

    it('creates a webhook subscriber', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .send({ channel_type: 'webhook', destination: 'https://hooks.ex/i' })
        .expect(201);
    });
  });
});
