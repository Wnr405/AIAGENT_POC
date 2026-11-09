import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../../../application/ports/out/auth-services.port';

/** CN-04 / FR-AUTH-03: Argon2id with OWASP-recommended minimum parameters. */
export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly opts: { memoryCost: number; timeCost: number; parallelism: number }) {}

  hash(plain: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment -- 2 = Argon2id; the const enum cannot be imported under isolated (SWC/tsx) transpilation
    return hash(plain, { ...this.opts, algorithm: 2 });
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      return false; // malformed hash ⇒ treat as mismatch, never throw to the caller
    }
  }
}
