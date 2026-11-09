import { ConflictError, ValidationError } from '../../../shared/kernel/errors';

export const API_KEY_PREFIX = 'cmsk_';

export interface ApiKeyProps {
  id: string;
  name: string;
  keyPrefix: string; // first chars shown in UI, e.g. cmsk_a1b2c3
  keyHash: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

/** FR-PUBAPI-02. The raw key is shown exactly once; only its hash is stored. CRITICAL PATH. */
export class ApiKey {
  private constructor(private props: ApiKeyProps) {}

  static create(props: Omit<ApiKeyProps, 'lastUsedAt' | 'revokedAt'>): ApiKey {
    const name = props.name.trim();
    if (name.length === 0 || name.length > 100) {
      throw new ValidationError('API key name is required (max 100 characters)', { field: 'name' });
    }
    return new ApiKey({ ...props, name, lastUsedAt: null, revokedAt: null });
  }

  static rehydrate(props: ApiKeyProps): ApiKey {
    return new ApiKey({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get isActive(): boolean {
    return this.props.revokedAt === null;
  }

  revoke(now: Date): void {
    if (this.props.revokedAt !== null) throw new ConflictError('API key is already revoked');
    this.props.revokedAt = now;
  }

  markUsed(now: Date): void {
    this.props.lastUsedAt = now;
  }

  toProps(): Readonly<ApiKeyProps> {
    return { ...this.props };
  }
}
