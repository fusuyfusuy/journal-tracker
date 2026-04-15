import type { JobsOptions } from 'bullmq';

export const CYCLE_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export const NOTIFY_QUEUE = 'notify';
export const NOTIFY_JOB = 'deliver';

export const NOTIFY_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: 500,
  removeOnFail: 200,
};
