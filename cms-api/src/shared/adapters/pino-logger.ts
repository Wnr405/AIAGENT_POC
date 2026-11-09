import pino, { type Logger as Pino } from 'pino';
import type { Logger } from '../ports/logger.port';

/**
 * NFR-OBS-01 structured JSON logs. SEC-14: emails, IPs, tokens and passwords
 * are redacted from every log line (user id is the only identity we log).
 */
export const REDACT_PATHS = [
  'email',
  '*.email',
  'ip',
  '*.ip',
  'actorIp',
  'password',
  '*.password',
  'token',
  '*.token',
  'refreshToken',
  'accessToken',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

export function createPino(level: string, base: Record<string, unknown>): Pino {
  return pino({
    level,
    base,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    formatters: { level: (label) => ({ level: label }) },
  });
}

export class PinoLogger implements Logger {
  constructor(private readonly pino: Pino) {}

  debug(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.debug(ctx ?? {}, msg);
  }
  info(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.info(ctx ?? {}, msg);
  }
  warn(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.warn(ctx ?? {}, msg);
  }
  error(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.error(ctx ?? {}, msg);
  }
}
