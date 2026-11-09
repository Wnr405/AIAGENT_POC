import type { Role } from '../../../../../shared/kernel/role';

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  readonly sub: string;
  readonly role: Role;
}

export interface TokenSigner {
  sign(claims: AccessTokenClaims, ttlSeconds: number): Promise<string>;
  /** Returns null for any invalid / expired / tampered token. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}

/** Implemented by the notifications module (wired in the composition root). */
export interface AuthMailer {
  sendInvite(to: { email: string; name: string }, link: string): Promise<void>;
  sendPasswordReset(to: { email: string; name: string }, link: string): Promise<void>;
}

export interface AuthSettings {
  readonly accessTokenTtlSeconds: number; // ≤ 3600 (FR-AUTH-04)
  readonly refreshTokenTtlSeconds: number; // ≤ 14 days (FR-AUTH-04)
  readonly publicUrl: string; // base URL of the admin SPA, for email links
}
