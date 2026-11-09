import { requireCapability, type ActorContext } from '../../../../shared/kernel/actor';
import { NotFoundError, UnauthorizedError } from '../../../../shared/kernel/errors';
import { API_KEY_PREFIX, ApiKey } from '../../domain/api-key.entity';
import type {
  ApiKeyView,
  AuthenticateApiKeyUseCase,
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  RevokeApiKeyUseCase,
} from '../ports/in/auth.ports';
import type { AuthDeps } from './auth-deps';

/** Avoid a DB write on every public request: refresh last_used_at at most once a minute. */
const LAST_USED_RESOLUTION_MS = 60_000;

function toView(key: ApiKey): ApiKeyView {
  const p = key.toProps();
  return {
    id: p.id,
    name: p.name,
    prefix: p.keyPrefix,
    lastUsedAt: p.lastUsedAt,
    revokedAt: p.revokedAt,
    createdAt: p.createdAt,
  };
}

/** FR-PUBAPI-02. CRITICAL PATH: creation + hashing. */
export class CreateApiKey implements CreateApiKeyUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(name: string, actor: ActorContext): Promise<ApiKeyView & { key: string }> {
    requireCapability(actor, 'api_keys.manage');
    const raw = `${API_KEY_PREFIX}${this.d.secrets.generate(32)}`;
    const now = this.d.clock.now();
    const key = ApiKey.create({
      id: this.d.ids.next(),
      name,
      keyPrefix: raw.slice(0, API_KEY_PREFIX.length + 6),
      keyHash: this.d.tokenHasher.hash(raw),
      createdBy: actor.userId,
      createdAt: now,
    });
    await this.d.apiKeys.save(key);
    await this.d.events.publishAll([
      {
        type: 'api_key.create',
        occurredAt: now,
        actorId: actor.userId,
        actorIp: actor.ip,
        target: { type: 'api_key', id: key.id },
        summary: { name: key.toProps().name },
      },
    ]);
    return { ...toView(key), key: raw };
  }
}

export class ListApiKeys implements ListApiKeysUseCase {
  constructor(private readonly d: Pick<AuthDeps, 'apiKeys'>) {}

  async execute(actor: ActorContext): Promise<ApiKeyView[]> {
    requireCapability(actor, 'api_keys.manage');
    return (await this.d.apiKeys.list()).map(toView);
  }
}

/** CRITICAL PATH: revocation. */
export class RevokeApiKey implements RevokeApiKeyUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(id: string, actor: ActorContext): Promise<void> {
    requireCapability(actor, 'api_keys.manage');
    const key = await this.d.apiKeys.findById(id);
    if (!key) throw new NotFoundError('API key', id);
    const now = this.d.clock.now();
    key.revoke(now);
    await this.d.apiKeys.save(key);
    await this.d.events.publishAll([
      {
        type: 'api_key.revoke',
        occurredAt: now,
        actorId: actor.userId,
        actorIp: actor.ip,
        target: { type: 'api_key', id },
        summary: {},
      },
    ]);
  }
}

/** UR-D04: `X-API-Key` authentication for the public API. CRITICAL PATH. */
export class AuthenticateApiKey implements AuthenticateApiKeyUseCase {
  constructor(private readonly d: Pick<AuthDeps, 'apiKeys' | 'tokenHasher' | 'clock'>) {}

  async execute(rawKey: string | undefined): Promise<{ apiKeyId: string }> {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) throw new UnauthorizedError('Invalid API key');
    const key = await this.d.apiKeys.findByHash(this.d.tokenHasher.hash(rawKey));
    if (!key || !key.isActive) throw new UnauthorizedError('Invalid API key');
    const now = this.d.clock.now();
    const last = key.toProps().lastUsedAt;
    if (last === null || now.getTime() - last.getTime() >= LAST_USED_RESOLUTION_MS) {
      key.markUsed(now);
      await this.d.apiKeys.save(key);
    }
    return { apiKeyId: key.id };
  }
}
