import { Test } from '@nestjs/testing';
import { NOTIFIER_TOKEN, type Notifier } from '@journal/shared';
import { NotifiersService } from './notifiers.service';

const fake = (channel: Notifier['channel']): Notifier => ({
  channel,
  async dispatch() {
    return {
      article_id: 0,
      subscriber_id: 0,
      channel,
      status: 'ok',
      dispatched_at: new Date().toISOString(),
    };
  },
});

describe('NotifiersService', () => {
  let service: NotifiersService;
  const email = fake('email');
  const webhook = fake('webhook');

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: NOTIFIER_TOKEN, useValue: [email, webhook] },
        NotifiersService,
      ],
    }).compile();

    service = moduleRef.get(NotifiersService);
  });

  it('resolves by channel type', () => {
    expect(service.resolve('email')).toBe(email);
    expect(service.resolve('webhook')).toBe(webhook);
  });

  it('throws for unknown channel', () => {
    expect(() => service.resolve('slack' as never)).toThrow(/no notifier registered/);
  });
});
