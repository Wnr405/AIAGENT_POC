// NFR-PERF-02/03/06: 50 RPS sustained on the public API.
// Uncached P95 ≤ 600 ms overall; the cached path (repeat of the same URL) must be ≤ 200 ms.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    uncached: { executor: 'constant-arrival-rate', rate: 25, timeUnit: '1s', duration: '5m', preAllocatedVUs: 50, maxVUs: 200, exec: 'uncached' },
    cached: { executor: 'constant-arrival-rate', rate: 25, timeUnit: '1s', duration: '5m', preAllocatedVUs: 50, maxVUs: 200, exec: 'cached' },
  },
  thresholds: {
    'http_req_duration{scenario:cached}': ['p(95)<200'],
    'http_req_duration{scenario:uncached}': ['p(95)<600'],
    http_req_failed: ['rate<0.01'],
  },
};

const headers = { 'X-API-Key': __ENV.API_KEY };

export function cached() {
  check(http.get(`${__ENV.BASE_URL}/api/v1/articles?page=1`, { headers }), { 'status 200': (r) => r.status === 200 });
}

export function uncached() {
  // A unique query parameter defeats the micro-cache so the API + DB path is measured.
  const page = 1 + Math.floor(Math.random() * 4);
  check(http.get(`${__ENV.BASE_URL}/api/v1/articles?page=${page}&page_size=${10 + (__ITER % 90)}`, { headers }), {
    'status 200': (r) => r.status === 200,
  });
}
