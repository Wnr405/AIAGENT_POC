import { readFileSync } from 'node:fs';

/** Compose healthcheck for cms-worker: healthy if the loop ticked in the last 2 minutes. */
const MAX_AGE_MS = 120_000;
try {
  const last = Number(readFileSync('/tmp/cms-worker-heartbeat', 'utf8'));
  process.exit(Date.now() - last < MAX_AGE_MS ? 0 : 1);
} catch {
  process.exit(1);
}
