/** FR-AUTH-06: 5 failed attempts within 10 minutes → locked for 15 minutes. */
export const LOCKOUT_POLICY = {
  maxFailures: 5,
  windowMs: 10 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
} as const;
