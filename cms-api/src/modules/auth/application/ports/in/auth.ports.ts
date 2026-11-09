import type { ActorContext } from '../../../../../shared/kernel/actor';
import type { Role } from '../../../../../shared/kernel/role';
import type { OneTimeTokenPurpose } from '../../../domain/one-time-token.entity';

export interface RequestMeta {
  readonly ip: string;
}

export interface SessionTokens {
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly user: { id: string; email: string; name: string; role: Role };
}

export interface LoginUseCase {
  execute(cmd: { email: string; password: string }, meta: RequestMeta): Promise<SessionTokens>;
}
export interface RefreshSessionUseCase {
  execute(refreshToken: string, meta: RequestMeta): Promise<SessionTokens>;
}
export interface LogoutUseCase {
  execute(refreshToken: string | undefined, meta: RequestMeta): Promise<void>;
}
export interface RequestPasswordResetUseCase {
  execute(email: string, meta: RequestMeta): Promise<void>;
}
export interface CompletePasswordResetUseCase {
  execute(cmd: { token: string; password: string }, meta: RequestMeta): Promise<void>;
}
export interface AcceptInviteUseCase {
  execute(cmd: { token: string; password: string }, meta: RequestMeta): Promise<void>;
}
export interface ChangeOwnPasswordUseCase {
  execute(cmd: { currentPassword: string; newPassword: string }, actor: ActorContext): Promise<void>;
}
export interface IssueOneTimeTokenUseCase {
  execute(userId: string, purpose: OneTimeTokenPurpose): Promise<void>;
}
export interface RevokeUserSessionsUseCase {
  execute(userId: string): Promise<void>;
}
export interface AuthenticateAccessTokenUseCase {
  /** Returns the authenticated principal or throws UnauthorizedError. */
  execute(token: string): Promise<{ userId: string; role: Role }>;
}

export interface ApiKeyView {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}
export interface CreateApiKeyUseCase {
  execute(name: string, actor: ActorContext): Promise<ApiKeyView & { key: string }>;
}
export interface ListApiKeysUseCase {
  execute(actor: ActorContext): Promise<ApiKeyView[]>;
}
export interface RevokeApiKeyUseCase {
  execute(id: string, actor: ActorContext): Promise<void>;
}
export interface AuthenticateApiKeyUseCase {
  execute(rawKey: string | undefined): Promise<{ apiKeyId: string }>;
}
