import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { JoseJwtSigner } from './jose-jwt-signer';

/** CN-04 / FR-AUTH-03 / FR-AUTH-04 — real crypto adapters (fast parameters for tests). */
describe('Argon2PasswordHasher (CN-04, FR-AUTH-03) — critical path', () => {
  const hasher = new Argon2PasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 });

  it('produces Argon2id hashes that never contain the plaintext', async () => {
    const hash = await hasher.hash('correct-horse-42');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct-horse-42');
    expect(await hasher.verify(hash, 'correct-horse-42')).toBe(true);
    expect(await hasher.verify(hash, 'wrong-horse-42')).toBe(false);
  });

  it('treats malformed hashes as a mismatch instead of throwing', async () => {
    expect(await hasher.verify('not-a-hash', 'x')).toBe(false);
  });
});

describe('JoseJwtSigner (FR-AUTH-04, ADR-0010) — critical path', () => {
  const signer = new JoseJwtSigner('x'.repeat(64));

  it('round-trips sub and role only', async () => {
    const token = await signer.sign({ sub: 'u1', role: 'editor' }, 60);
    expect(await signer.verify(token)).toEqual({ sub: 'u1', role: 'editor' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'role', 'sub']);
  });

  it('rejects tampered, foreign-key, expired and malformed tokens', async () => {
    const token = await signer.sign({ sub: 'u1', role: 'admin' }, 60);
    const [h, , s] = token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', exp: 9e9 })).toString('base64url')}.${s}`;
    expect(await signer.verify(forged)).toBeNull();
    expect(await new JoseJwtSigner('y'.repeat(64)).verify(token)).toBeNull();
    expect(await signer.verify(await signer.sign({ sub: 'u1', role: 'admin' }, -1))).toBeNull();
    expect(await signer.verify('garbage')).toBeNull();
  });
});
