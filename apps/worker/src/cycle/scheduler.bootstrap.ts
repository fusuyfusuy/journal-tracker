import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { AppConfig, CYCLE_JOB_OPTS, StructuredLogger } from '@journal/shared';
import { CYCLE_JOB, CYCLE_QUEUE } from './cycle.processor';

/**
 * Registers a repeatable BullMQ job on worker boot.
 * The job runs every `app.checkIntervalMs` with a stable jobId so only
 * one schedule is ever active, even after restarts.
 */
@Injectable()
export class SchedulerBootstrap implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(CYCLE_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
    private readonly log: StructuredLogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const app = this.config.getOrThrow<AppConfig>('app');
    const everyMs = app.checkIntervalMs;

    await this.queue.add(
      CYCLE_JOB,
      {},
      {
        ...CYCLE_JOB_OPTS,
        repeat: { every: everyMs },
        jobId: 'cycle-repeat',
      },
    );

    this.log.info('scheduler.registered', { every_ms: everyMs });
  }
}
