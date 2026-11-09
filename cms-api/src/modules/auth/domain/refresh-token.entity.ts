export interface RefreshTokenProps {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

/** SEC-12: a session idles out after 30 minutes without a refresh. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/**
 * Opaque refresh token (ADR-0010): stored hashed, rotated on every use;
 * presenting an already-rotated token is treated as theft → whole family revoked.
 * CRITICAL PATH.
 */
export class RefreshToken {
  private constructor(private props: RefreshTokenProps) {}

  static issue(props: Omit<RefreshTokenProps, 'revokedAt' | 'replacedById'>): RefreshToken {
    return new RefreshToken({ ...props, revokedAt: null, replacedById: null });
  }

  static rehydrate(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get familyId(): string {
    return this.props.familyId;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  /** Already rotated — any further use is a replay. */
  wasRotated(): boolean {
    return this.props.replacedById !== null;
  }

  isUsableAt(now: Date): boolean {
    const t = now.getTime();
    return (
      !this.isRevoked() && t < this.props.expiresAt.getTime() && t - this.props.issuedAt.getTime() <= SESSION_IDLE_MS
    );
  }

  rotateTo(nextId: string, now: Date): void {
    this.props.replacedById = nextId;
    this.props.revokedAt = now;
  }

  revoke(now: Date): void {
    if (this.props.revokedAt === null) this.props.revokedAt = now;
  }

  toProps(): Readonly<RefreshTokenProps> {
    return { ...this.props };
  }
}
