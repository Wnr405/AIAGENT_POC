/**
 * Domain/application error taxonomy. Driving adapters map these to HTTP
 * status codes (see adapters/in/http/error-mapping). Never throw raw Errors
 * from domain or application code — always one of these.
 */
export type ErrorDetails = Record<string, unknown>;

export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(
    message: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 422 — input is well-formed but violates a business rule. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}

/** 404 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(resource: string, id?: string) {
    super(`${resource} not found`, id === undefined ? undefined : { resource, id });
  }
}

/** 403 — authenticated but not allowed. Message stays generic (FR-AUTHZ-05). */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
  }
}

/** 401 — not authenticated or credentials invalid. Generic by design (FR-AUTH-06). */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  constructor(message = 'Authentication required') {
    super(message);
  }
}

/** 409 — slug collision, invalid lifecycle transition, referenced resource. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

/** 429 */
export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED';
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests', { retryAfterSeconds });
  }
}
