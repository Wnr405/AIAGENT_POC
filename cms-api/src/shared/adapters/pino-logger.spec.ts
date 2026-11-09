import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { PinoLogger, REDACT_PATHS } from './pino-logger';

/** SEC-14 / FR-AUTH-03: secrets and PII never reach the logs. */
describe('PinoLogger redaction (SEC-14)', () => {
  it('redacts email, ip, password and tokens', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write: (chunk: Buffer, _enc, cb) => {
        lines.push(chunk.toString());
        cb();
      },
    });
    const logger = new PinoLogger(pino({ redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, sink));
    logger.info('login', { email: 'a@b.co', ip: '1.2.3.4', password: 'hunter2hunter2', token: 't', userId: 'u1' });
    const rec = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(rec).toMatchObject({
      email: '[redacted]',
      ip: '[redacted]',
      password: '[redacted]',
      token: '[redacted]',
      userId: 'u1',
      msg: 'login',
    });
  });
});
