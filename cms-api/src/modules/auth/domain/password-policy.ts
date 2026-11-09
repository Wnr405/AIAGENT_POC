import { ValidationError } from '../../../shared/kernel/errors';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

/**
 * FR-AUTH-02: ≥ 12 chars, at least one letter and one digit.
 * Upper bound guards the KDF against DoS via huge inputs.
 * CRITICAL PATH.
 */
export function assertPasswordPolicy(plain: string): void {
  const problems: string[] = [];
  if (plain.length < PASSWORD_MIN_LENGTH) problems.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (plain.length > PASSWORD_MAX_LENGTH) problems.push(`at most ${PASSWORD_MAX_LENGTH} characters`);
  if (!/\p{L}/u.test(plain)) problems.push('at least one letter');
  if (!/\p{Nd}/u.test(plain)) problems.push('at least one digit');
  if (problems.length > 0) {
    throw new ValidationError(`Password must contain ${problems.join(', ')}`, { field: 'password' });
  }
}
