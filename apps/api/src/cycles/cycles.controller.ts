import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Module, Param, Post } from '@nestjs/common';
import { Queue } from 'bullmq';

const CYCLE_QUEUE = 'cycle';
const CYCLE_JOB = 'run-cycle';

@Controller('cycles')
export class CyclesController {
  constructor(@InjectQueue(CYCLE_QUEUE) private readonly queue: Queue) {}

  @Post()
  async trigger() {
    const job = await this.queue.add(CYCLE_JOB, { source: 'api' }, { removeOnComplete: 100 });
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
