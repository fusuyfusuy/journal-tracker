import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Module, Param, Post } from '@nestjs/common';
import { CYCLE_JOB, CYCLE_JOB_OPTS, CYCLE_QUEUE } from '@journal/shared';
import { Throttle } from '@nestjs/throttler';
import { Queue } from 'bullmq';

@Controller('cycles')
export class CyclesController {
  constructor(@InjectQueue(CYCLE_QUEUE) private readonly queue: Queue) {}

  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post()
  async trigger() {
    const job = await this.queue.add(CYCLE_JOB, { source: 'api' }, { ...CYCLE_JOB_OPTS });
    return { id: job.id, queued_at: new Date().toISOString() };
  }

  @Get()
  async list() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const job = await this.queue.getJob(id);
    if (!job) return { id, status: 'not-found' };
    const state = await job.getState();
    return {
      id: job.id,
      name: job.name,
      state,
      progress: job.progress,
      return_value: job.returnvalue,
      failed_reason: job.failedReason,
      finished_on: job.finishedOn,
    };
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: CYCLE_QUEUE })],
  controllers: [CyclesController],
})
export class CyclesModule {}
