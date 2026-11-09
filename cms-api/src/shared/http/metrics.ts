import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/** NFR-OBS-02: request count, errors, latency histogram — by route. */
export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'cms_' });

const requests = new Counter({
  name: 'cms_http_requests_total',
  help: 'HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

const duration = new Histogram({
  name: 'cms_http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status_class'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.5, 3],
  registers: [registry],
});

export const jobRuns = new Counter({
  name: 'cms_worker_job_runs_total',
  help: 'Background job executions',
  labelNames: ['job', 'outcome'] as const,
  registers: [registry],
});

export const httpMetrics = {
  observe(method: string, route: string, status: number, seconds: number): void {
    requests.inc({ method, route, status: String(status) });
    duration.observe({ method, route, status_class: `${Math.floor(status / 100)}xx` }, seconds);
  },
};
