import type { Clock } from '../../../../shared/ports/clock.port';
import type { SecretGenerator, TokenHasher } from '../../../../shared/ports/crypto.port';
import type { DomainEventPublisher } from '../../../../shared/ports/event-publisher.port';
import type { IdGenerator } from '../../../../shared/ports/id-generator.port';
import type {
  ApiKeyRepository,
  AuthAccountRepository,
  OneTimeTokenRepository,
  RefreshTokenRepository,
} from '../ports/out/auth-repositories.port';
import type { AuthMailer, AuthSettings, PasswordHasher, TokenSigner } from '../ports/out/auth-services.port';

export interface AuthDeps {
  readonly accounts: AuthAccountRepository;
  readonly refreshTokens: RefreshTokenRepository;
  readonly oneTimeTokens: OneTimeTokenRepository;
  readonly apiKeys: ApiKeyRepository;
  readonly hasher: PasswordHasher;
  readonly signer: TokenSigner;
  readonly mailer: AuthMailer;
  readonly secrets: SecretGenerator;
  readonly tokenHasher: TokenHasher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly events: DomainEventPublisher;
  readonly settings: AuthSettings;
}
