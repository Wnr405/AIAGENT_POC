import './tracing';
import { Worker } from 'bullmq';
import { writeFileSync } from 'node:fs';
import { buildContainer } from './composition/container';
import { buildRuntime } from './composition/production-infrastructure';
import { loadEnv } from './config/env.schema';
import { settingsFromEnv } from './config/settings';
import { QUEUE_NAME } from './shared/adapters/bullmq-job-scheduler';
import { SYSTEM_ACTOR } from './shared/kernel/actor';
import { jobRuns } from './shared/http/metrics';
import { GENERATE_VARIANTS_JOB } from './modules/media/application/use-cases/media.use-cases';
import { initSentry, captureException } from './shared/http/sentry';

/** Heartbeat file checked by `dist/scripts/worker-heartbeat.js` (compose healthcheck). */
export const HEARTBEAT_FILE = '/tmp/cms-worker-heartbeat';

/**
 * cms-worker container (07-OPS-ARCH §4.1): same image as the API, different
 * command. Driving adapters: a timer for scheduled publish / purges and a
 * BullMQ consumer for image variants.
 */
async function main(): Promise<void> {
  const env = loadEnv({ ...process.env, ROLE: 'worker' });
  initSentry(env.SENTRY_DSN, env.SENTRY_ENV ?? env.NODE_ENV, env.APP_VERSION, env.SENTRY_SAMPLE_RATE);
  const runtime = buildRuntime(env);
  const c = buildContainer(runtime.infra, settingsFromEnv(env));
  const log = runtime.infra.logger;

  const run = async (job: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      const n = await fn();
      jobRuns.inc({ job, outcome: 'ok' });
      if (typeof n === 'number' && n > 0) log.info('job done', { job, count: n });
    } catch (err) {
      jobRuns.inc({ job, outcome: 'error' });
      log.error('job failed', { job, error: err instanceof Error ? err.message : String(err) });
      captureException(err, { job });
    }
  };

  // ScheduledPublishJob (FR-CONTENT-07): interval ≤ 30 s keeps "within 60 s" acceptance.
  const tick = async (): Promise<void> => {
    if (env.FEATURE_SCHEDULED_PUBLISH_ENABLED)
      await run('scheduled-publish', () => c.jobs.publishDue.publishDue(SYSTEM_ACTOR));
    writeFileSync(HEARTBEAT_FILE, String(Date.now()));
  };
  const publishTimer = setInterval(() => void tick(), env.WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC * 1000);
  await tick();

  // Purges (FR-CONTENT-13 + media): hourly is plenty.
  const purge = async (): Promise<void> => {
    await run('purge-content', () => c.jobs.purgeContent.purgeDeleted(SYSTEM_ACTOR));
    await run('purge-media', () => c.jobs.purgeMedia.execute(SYSTEM_ACTOR));
  };
  const purgeTimer = setInterval(() => void purge(), 3600_000);

  // ImageVariantWorker (FR-MEDIA-05)
  const worker = runtime.redis
    ? new Worker(
        QUEUE_NAME,
        async (job) => {
          if (job.name === GENERATE_VARIANTS_JOB) {
            await c.jobs.generateVariants.execute((job.data as { mediaId: string }).mediaId);
          }
        },
        { connection: runtime.redis, concurrency: env.WORKER_CONCURRENCY },
      )
    : null;
  worker?.on('failed', (job, err) => {
    log.error('queue job failed', { job: job?.name, error: err.message });
  });

  const stop = async (): Promise<void> => {
    clearInterval(publishTimer);
    clearInterval(purgeTimer);
    await worker?.close();
    await runtime.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
  log.info('cms-worker started', { intervalSec: env.WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC });
}

void main();
