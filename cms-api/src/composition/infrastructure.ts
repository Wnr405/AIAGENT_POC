import type { Cache } from '../shared/ports/cache.port';
import type { Clock } from '../shared/ports/clock.port';
import type { SecretGenerator, TokenHasher } from '../shared/ports/crypto.port';
import type { DomainEventPublisher, DomainEventSubscriber } from '../shared/ports/event-publisher.port';
import type { IdGenerator } from '../shared/ports/id-generator.port';
import type { JobScheduler } from '../shared/ports/job-scheduler.port';
import type { Logger } from '../shared/ports/logger.port';
import type { RateLimiter } from '../shared/ports/rate-limiter.port';
import type { TransactionRunner } from '../shared/ports/transaction-runner.port';
import type { UserRepository } from '../modules/users/application/ports/out/user-repository.port';
import type {
  ApiKeyRepository,
  AuthAccountRepository,
  OneTimeTokenRepository,
  RefreshTokenRepository,
} from '../modules/auth/application/ports/out/auth-repositories.port';
import type { PasswordHasher, TokenSigner } from '../modules/auth/application/ports/out/auth-services.port';
import type {
  ContentRepository,
  ContentVersionRepository,
} from '../modules/content/application/ports/out/content-ports';
import type {
  ImageProcessor,
  MediaRepository,
  ObjectStorage,
} from '../modules/media/application/ports/out/media-ports';
import type { AuditEventRepository } from '../modules/audit/application/ports/out/audit-ports';
import type { EmailSender } from '../modules/notifications/application/ports/out/email-sender.port';

/** Every driven adapter the application needs. Built from env (prod) or in memory (tests/dev). */
export interface Infrastructure {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly secrets: SecretGenerator;
  readonly tokenHasher: TokenHasher;
  readonly logger: Logger;
  readonly cache: Cache;
  readonly rateLimiter: RateLimiter;
  readonly jobs: JobScheduler;
  readonly tx: TransactionRunner;
  readonly events: DomainEventPublisher & DomainEventSubscriber;
  readonly passwordHasher: PasswordHasher;
  readonly tokenSigner: TokenSigner;
  readonly emailSender: EmailSender;
  readonly storage: ObjectStorage;
  readonly images: ImageProcessor;
  readonly repos: {
    readonly users: UserRepository;
    readonly authAccounts: AuthAccountRepository;
    readonly refreshTokens: RefreshTokenRepository;
    readonly oneTimeTokens: OneTimeTokenRepository;
    readonly apiKeys: ApiKeyRepository;
    readonly contents: ContentRepository;
    readonly versions: ContentVersionRepository;
    readonly media: MediaRepository;
    readonly audit: AuditEventRepository;
  };
}

export interface AppSettings {
  readonly appName: string;
  readonly publicUrl: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly categories: readonly string[];
  readonly softDeleteRetentionDays: number;
  readonly maxUploadBytes: number;
  readonly presignTtlSeconds: number;
  readonly variantsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'CMS',
  publicUrl: 'http://localhost:5173',
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 14 * 24 * 3600,
  categories: ['News', 'Reports', 'Guides', 'Announcements'],
  softDeleteRetentionDays: 30,
  maxUploadBytes: 20 * 1024 * 1024,
  presignTtlSeconds: 900,
  variantsEnabled: true,
};
