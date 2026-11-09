import type { AuthAccount } from '../../../domain/auth-account.entity';
import type { RefreshToken } from '../../../domain/refresh-token.entity';
import type { OneTimeToken, OneTimeTokenPurpose } from '../../../domain/one-time-token.entity';
import type { ApiKey } from '../../../domain/api-key.entity';

export interface AuthAccountRepository {
  findByEmail(email: string): Promise<AuthAccount | null>;
  findById(userId: string): Promise<AuthAccount | null>;
  save(account: AuthAccount): Promise<void>;
}

export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findByHash(hash: string): Promise<RefreshToken | null>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

export interface OneTimeTokenRepository {
  save(token: OneTimeToken): Promise<void>;
  findByHash(hash: string): Promise<OneTimeToken | null>;
  /** Marks every unused token of that purpose for the user as used (only the newest link works). */
  invalidateAll(userId: string, purpose: OneTimeTokenPurpose, now: Date): Promise<void>;
}

export interface ApiKeyRepository {
  save(key: ApiKey): Promise<void>;
  findById(id: string): Promise<ApiKey | null>;
  findByHash(hash: string): Promise<ApiKey | null>;
  list(): Promise<ApiKey[]>;
}
