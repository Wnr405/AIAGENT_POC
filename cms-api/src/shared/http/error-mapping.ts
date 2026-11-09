import { ZodError } from 'zod';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from '../kernel/errors';

export interface ErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface HttpError {
  status: number;
  body: ErrorEnvelope;
  headers?: Record<string, string>;
  /** true → unexpected; log + report to Sentry (NFR-OBS-04). */
  unexpected: boolean;
}

const envelope = (code: string, message: string, details?: Record<string, unknown>): ErrorEnvelope => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** Most specific first; anything else that is a DomainError maps to 400. */
const DOMAIN_STATUS: readonly (readonly [new (...args: never[]) => DomainError, number])[] = [
  [ValidationError, 422],
  [NotFoundError, 404],
  [ForbiddenError, 403],
  [UnauthorizedError, 401],
  [ConflictError, 409],
  [RateLimitedError, 429],
];

function fromZod(err: ZodError): HttpError {
  const fields = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  return {
    status: 422,
    body: envelope('VALIDATION_ERROR', 'Request validation failed', { fields }),
    unexpected: false,
  };
}

function fromDomain(err: DomainError): HttpError {
  const status = DOMAIN_STATUS.find(([type]) => err instanceof type)?.[1] ?? 400;
  const headers = err instanceof RateLimitedError ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined;
  return { status, body: envelope(err.code, err.message, err.details), headers, unexpected: false };
}

function httpCode(status: number): string {
  if (status === 404) return 'NOT_FOUND';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  return status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR';
}

/** Nest HttpException-like errors (anything exposing getStatus()). */
function fromHttpException(err: { getStatus: () => number; message?: string }): HttpError {
  const status = err.getStatus();
  const message = status < 500 ? (err.message ?? 'Bad request') : 'Internal server error';
  return { status, body: envelope(httpCode(status), message), unexpected: status >= 500 };
}

function isHttpException(err: unknown): err is { getStatus: () => number; message?: string } {
  return typeof err === 'object' && err !== null && typeof (err as { getStatus?: unknown }).getStatus === 'function';
}

function isClientBodyParserError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

/**
 * 04-ARCH §6.4 / 02-SRS §7.4–7.5: one place that turns any thrown value into
 * the standard error envelope. Unknown errors never leak their message.
 */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof ZodError) return fromZod(err);
  if (err instanceof DomainError) return fromDomain(err);
  if (isHttpException(err)) return fromHttpException(err);
  if (isClientBodyParserError(err)) {
    return { status: 400, body: envelope('BAD_REQUEST', 'Malformed request body'), unexpected: false };
  }
  return { status: 500, body: envelope('INTERNAL_ERROR', 'Internal server error'), unexpected: true };
}
