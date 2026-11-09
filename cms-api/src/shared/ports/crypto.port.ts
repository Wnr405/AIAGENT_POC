/** Cryptographically secure random secrets + one-way hashing of opaque tokens. */
export interface SecretGenerator {
  /** URL-safe random string with `bytes` bytes of entropy. */
  generate(bytes: number): string;
}

export interface TokenHasher {
  /** Deterministic one-way hash (SHA-256 hex). Used for refresh tokens, API keys, one-time tokens. */
  hash(token: string): string;
}
