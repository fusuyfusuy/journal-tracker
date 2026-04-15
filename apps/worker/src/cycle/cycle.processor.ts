import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StructuredLogger } from '@journal/shared';
import { CycleService } from './cycle.service';

export const CYCLE_QUEUE = 'cycle';
export const CYCLE_JOB = 'run-cycle';

@Processor(CYCLE_QUEUE)
export class CycleProcessor extends WorkerHost {
  constructor(
    private readonly cycle: CycleService,
    private readonly log: StructuredLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.log.info('cycle.start', { job_id: job.id, name: job.name });
    try {
      const summary = await this.cycle.run();
      return summary;
    } catch (e) {
      this.log.error('cycle.failed', { job_id: job.id, message: (e as Error).message });
      throw e;
    }
  }
}
