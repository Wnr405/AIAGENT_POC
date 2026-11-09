import type { Role } from '../../../shared/kernel/role';
import { LOCKOUT_POLICY } from './lockout-policy';

export type AccountStatus = 'invited' | 'active' | 'deactivated';

export interface AuthAccountProps {
  userId: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  passwordHash: string | null;
  failedLoginCount: number;
  failedWindowStartedAt: Date | null;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}

/**
 * Credentials + lockout state for a user (auth module view of the users row).
 * CRITICAL PATH: account lockout.
 */
export class AuthAccount {
  private constructor(private props: AuthAccountProps) {}

  static rehydrate(props: AuthAccountProps): AuthAccount {
    return new AuthAccount({ ...props });
  }

  get userId(): string {
    return this.props.userId;
  }
  get email(): string {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get role(): Role {
    return this.props.role;
  }
  get status(): AccountStatus {
    return this.props.status;
  }
  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  isLockedAt(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  /**
   * The password hash to verify against, or null when this account may not
   * authenticate at all right now (not active, no password yet, or locked).
   */
  loginHashAt(now: Date): string | null {
    if (this.props.status !== 'active' || this.isLockedAt(now)) return null;
    return this.props.passwordHash;
  }

  /** Returns true when this failure caused a lock. */
  registerFailedLogin(now: Date): boolean {
    const start = this.props.failedWindowStartedAt;
    const windowExpired = start === null || now.getTime() - start.getTime() > LOCKOUT_POLICY.windowMs;
    if (windowExpired) {
      this.props.failedWindowStartedAt = now;
      this.props.failedLoginCount = 1;
    } else {
      this.props.failedLoginCount += 1;
    }
    if (this.props.failedLoginCount >= LOCKOUT_POLICY.maxFailures) {
      this.props.lockedUntil = new Date(now.getTime() + LOCKOUT_POLICY.lockMs);
      this.props.failedLoginCount = 0;
      this.props.failedWindowStartedAt = null;
      return true;
    }
    return false;
  }

  registerSuccessfulLogin(now: Date): void {
    this.props.failedLoginCount = 0;
    this.props.failedWindowStartedAt = null;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = now;
  }

  /** Sets a new password; activates an invited account; clears any lock. */
  setPasswordHash(hash: string): void {
    this.props.passwordHash = hash;
    if (this.props.status === 'invited') this.props.status = 'active';
    this.props.failedLoginCount = 0;
    this.props.failedWindowStartedAt = null;
    this.props.lockedUntil = null;
  }

  toProps(): Readonly<AuthAccountProps> {
    return { ...this.props };
  }
}
