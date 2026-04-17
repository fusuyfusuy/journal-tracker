import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFIER_TOKEN, NOTIFY_QUEUE } from '@journal/shared';
import { EmailNotifier } from './email.notifier';
import { NotifyProcessor } from './notify.processor';
import { NotifiersService } from './notifiers.service';
import { WebhookNotifier } from './webhook.notifier';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFY_QUEUE })],
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
  exports: [NotifiersService, BullModule],
})
export class NotifiersModule {}
