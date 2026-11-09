import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { JobScheduler } from '../ports/job-scheduler.port';

export const QUEUE_NAME = 'cms-jobs';

export class BullMqJobScheduler implements JobScheduler {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUE_NAME, { connection });
  }

  async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    await this.queue.add(name, payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
