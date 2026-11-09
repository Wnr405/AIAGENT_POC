import type { DomainEvent } from '../../src/shared/kernel/domain-event';
import type { SecretGenerator } from '../../src/shared/ports/crypto.port';
import type { IdGenerator } from '../../src/shared/ports/id-generator.port';
import type { JobScheduler } from '../../src/shared/ports/job-scheduler.port';
import type { Logger } from '../../src/shared/ports/logger.port';
import type {
  AccessTokenClaims,
  PasswordHasher,
  TokenSigner,
} from '../../src/modules/auth/application/ports/out/auth-services.port';
import type {
  EmailMessage,
  EmailSender,
} from '../../src/modules/notifications/application/ports/out/email-sender.port';
import type { ImageProcessor } from '../../src/modules/media/application/ports/out/media-ports';
import type { Clock } from '../../src/shared/ports/clock.port';
import { isRole } from '../../src/shared/kernel/role';

/** Deterministic UUID-shaped ids: 00000000-0000-4000-8000-000000000001, … */
export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

export class FakeSecretGenerator implements SecretGenerator {
  private n = 0;
  generate(bytes: number): string {
    this.n += 1;
    return `secret${this.n}`.padEnd(Math.min(bytes, 43), 'x');
  }
}

/** Reversible "hash" so tests stay fast; never use outside tests. */
export class FakePasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }
  verify(hash: string, plain: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

/** Token = base64(JSON claims + expiry). Verifies expiry against the injected clock. */
export class FakeTokenSigner implements TokenSigner {
  constructor(private readonly clock: Clock) {}

  sign(claims: AccessTokenClaims, ttlSeconds: number): Promise<string> {
    const exp = this.clock.now().getTime() + ttlSeconds * 1000;
    return Promise.resolve(`fake.${Buffer.from(JSON.stringify({ ...claims, exp })).toString('base64url')}`);
  }

  verify(token: string): Promise<AccessTokenClaims | null> {
    if (!token.startsWith('fake.')) return Promise.resolve(null);
    try {
      const c = JSON.parse(Buffer.from(token.slice(5), 'base64url').toString()) as AccessTokenClaims & { exp: number };
      if (c.exp <= this.clock.now().getTime() || !isRole(c.role)) return Promise.resolve(null);
      return Promise.resolve({ sub: c.sub, role: c.role });
    } catch {
      return Promise.resolve(null);
    }
  }
}

export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
  /** Extracts the `token` query param from the last email to `to`. */
  lastTokenFor(to: string): string {
    const msg = [...this.sent].reverse().find((m) => m.to === to);
    const match = msg?.text.match(/token=([^\s&]+)/);
    if (!match?.[1]) throw new Error(`no token email for ${to}`);
    return decodeURIComponent(match[1]);
  }
}

export class RecordingJobScheduler implements JobScheduler {
  readonly jobs: { name: string; payload: Record<string, unknown> }[] = [];
  enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    this.jobs.push({ name, payload });
    return Promise.resolve();
  }
}

export class SilentLogger implements Logger {
  readonly errors: { msg: string; ctx?: Record<string, unknown> }[] = [];
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(msg: string, ctx?: Record<string, unknown>): void {
    this.errors.push({ msg, ctx });
  }
}

export class FakeImageProcessor implements ImageProcessor {
  probe(): Promise<{ width: number; height: number }> {
    return Promise.resolve({ width: 2000, height: 1000 });
  }
  resize(_data: Uint8Array, maxWidth: number): Promise<{ data: Uint8Array; width: number; height: number }> {
    return Promise.resolve({ data: new Uint8Array([1, 2, 3]), width: maxWidth, height: Math.round(maxWidth / 2) });
  }
}

export class RecordingEventPublisher {
  readonly events: DomainEvent[] = [];
  publishAll(events: readonly DomainEvent[]): Promise<void> {
    this.events.push(...events);
    return Promise.resolve();
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
}
