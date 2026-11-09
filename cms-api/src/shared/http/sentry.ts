import * as Sentry from '@sentry/node';

let enabled = false;

/** NFR-OBS-04: 5xx errors go to Sentry when SENTRY_DSN is configured. */
export function initSentry(dsn: string | undefined, environment: string, release: string, sampleRate: number): void {
  if (!dsn) return;
  Sentry.init({ dsn, environment, release, sampleRate, sendDefaultPii: false });
  enabled = true;
}

export function captureException(err: unknown, tags: Record<string, string | undefined>): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(tags)) if (v) scope.setTag(k, v);
    Sentry.captureException(err);
  });
}
