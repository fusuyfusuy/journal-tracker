import { Module } from '@nestjs/common';
import { NOTIFIER_TOKEN } from '@journal/shared';
import { EmailNotifier } from './email.notifier';
import { NotifyProcessor } from './notify.processor';
import { NotifiersService } from './notifiers.service';
import { WebhookNotifier } from './webhook.notifier';

@Module({
  imports: [],
  providers: [
    EmailNotifier,
    WebhookNotifier,
    {
      provide: NOTIFIER_TOKEN,
      useFactory: (email: EmailNotifier, webhook: WebhookNotifier) => [email, webhook],
      inject: [EmailNotifier, WebhookNotifier],
    },
    NotifiersService,
    NotifyProcessor,
  ],
  exports: [NotifiersService],
})
export class NotifiersModule {}
