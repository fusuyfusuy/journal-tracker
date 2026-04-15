import { Module } from '@nestjs/common';
import { NOTIFIER_TOKEN } from '@journal/shared';
import { EmailNotifier } from './email.notifier';
import { NotifiersService } from './notifiers.service';
import { WebhookNotifier } from './webhook.notifier';

@Module({
  providers: [
    EmailNotifier,
    WebhookNotifier,
    {
      provide: NOTIFIER_TOKEN,
      useFactory: (email: EmailNotifier, webhook: WebhookNotifier) => [email, webhook],
      inject: [EmailNotifier, WebhookNotifier],
    },
    NotifiersService,
  ],
  exports: [NotifiersService],
})
export class NotifiersModule {}
