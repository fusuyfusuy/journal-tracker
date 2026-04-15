import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Journal, Subscriber } from '@journal/database';
import { SubscribersService } from './subscribers.service';

describe('SubscribersService', () => {
  let moduleRef: TestingModule;
  let service: SubscribersService;

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
        TypeOrmModule.forFeature([Subscriber]),
      ],
      providers: [SubscribersService],
    }).compile();

    service = moduleRef.get(SubscribersService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('accepts a valid email subscriber', async () => {
    const s = await service.create({ channel_type: 'email', destination: 'u@example.com' });
    expect(s.id).toBeDefined();
  });

  it('accepts a valid webhook subscriber', async () => {
    const s = await service.create({ channel_type: 'webhook', destination: 'https://hook.example/in' });
    expect(s.id).toBeDefined();
  });

  it('rejects a non-email destination on channel=email', async () => {
    await expect(
      service.create({ channel_type: 'email', destination: 'not-an-email' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-URL destination on channel=webhook', async () => {
    await expect(
      service.create({ channel_type: 'webhook', destination: 'user@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('get() throws NotFoundException for unknown id', async () => {
    await expect(service.get(123)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-validates destination on update', async () => {
    const s = await service.create({ channel_type: 'email', destination: 'u@example.com' });
    await expect(
      service.update(s.id, { destination: 'broken' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
