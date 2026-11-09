import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SecretGenerator, TokenHasher } from '../ports/crypto.port';
import type { IdGenerator } from '../ports/id-generator.port';

export class UuidV4Generator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class NodeSecretGenerator implements SecretGenerator {
  generate(bytes: number): string {
    return randomBytes(bytes).toString('base64url');
  }
}

export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
