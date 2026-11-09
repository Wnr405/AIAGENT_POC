import { jwtVerify, SignJWT } from 'jose';
import { isRole } from '../../../../../shared/kernel/role';
import type { AccessTokenClaims, TokenSigner } from '../../../application/ports/out/auth-services.port';

/** HS256 access tokens (ADR-0010). Only `sub` and `role` are embedded — no PII. */
export class JoseJwtSigner implements TokenSigner {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly issuer = 'cms-api',
    private readonly audience = 'cms-admin',
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(claims: AccessTokenClaims, ttlSeconds: number): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || !isRole(payload['role'])) return null;
      return { sub: payload.sub, role: payload['role'] };
    } catch {
      return null;
    }
  }
}
