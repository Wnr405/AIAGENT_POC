/** Mirrors the backend error envelope (02-SRS §7.4). */
export interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** status 0 = network failure (no response). */
  static network(): ApiError {
    return new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  /**
   * 04-ARCH §6.4: field-keyed messages for forms. Handles both
   * `{ field }` (domain errors) and `{ fields: [{ field, message }] }` (schema errors).
   */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const single = this.details['field'];
    if (typeof single === 'string') out[single] = this.message;
    const list = this.details['fields'];
    if (Array.isArray(list)) {
      for (const f of list as { field?: unknown; message?: unknown }[]) {
        if (typeof f.field === 'string' && typeof f.message === 'string' && !(f.field in out)) out[f.field] = f.message;
      }
    }
    return out;
  }
}
