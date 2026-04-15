import { Inject, Injectable } from '@nestjs/common';
import type { ChannelType, Notifier } from '@journal/shared';
import { NOTIFIER_TOKEN } from '@journal/shared';

@Injectable()
export class NotifiersService {
  private readonly byChannel: Map<ChannelType, Notifier>;

  constructor(@Inject(NOTIFIER_TOKEN) notifiers: Notifier[]) {
    this.byChannel = new Map(notifiers.map((n) => [n.channel, n]));
  }

  resolve(channel: ChannelType): Notifier {
    const n = this.byChannel.get(channel);
    if (!n) throw new Error(`no notifier registered for channel "${channel}"`);
    return n;
  }
}
