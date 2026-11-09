export type OneTimeTokenPurpose = 'invite' | 'password_reset';

/** FR-USER-02 (7 days) / FR-AUTH-07 (60 minutes). */
export const ONE_TIME_TOKEN_TTL_MS: Record<OneTimeTokenPurpose, number> = {
  invite: 7 * 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

export interface OneTimeTokenProps {
  id: string;
  userId: string;
  purpose: OneTimeTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/** Single-use, expiring token for invites and password resets (FR-AUTH-08). CRITICAL PATH. */
export class OneTimeToken {
  private constructor(private props: OneTimeTokenProps) {}

  static issue(input: {
    id: string;
    userId: string;
    purpose: OneTimeTokenPurpose;
    tokenHash: string;
    now: Date;
  }): OneTimeToken {
    return new OneTimeToken({
      id: input.id,
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + ONE_TIME_TOKEN_TTL_MS[input.purpose]),
      usedAt: null,
    });
  }

  static rehydrate(props: OneTimeTokenProps): OneTimeToken {
    return new OneTimeToken({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get purpose(): OneTimeTokenPurpose {
    return this.props.purpose;
  }

  isValidAt(now: Date, purpose: OneTimeTokenPurpose): boolean {
    return (
      this.props.purpose === purpose && this.props.usedAt === null && now.getTime() < this.props.expiresAt.getTime()
    );
  }

  consume(now: Date): void {
    this.props.usedAt = now;
  }

  toProps(): Readonly<OneTimeTokenProps> {
    return { ...this.props };
  }
}
