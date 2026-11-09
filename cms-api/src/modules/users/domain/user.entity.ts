import { AggregateRoot } from '../../../shared/kernel/domain-event';
import { Email } from '../../../shared/kernel/email.vo';
import { ValidationError, ConflictError } from '../../../shared/kernel/errors';
import type { Role } from '../../../shared/kernel/role';
import type { ActorContext } from '../../../shared/kernel/actor';

export const USER_STATUSES = ['invited', 'active', 'deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserProps {
  id: string;
  email: Email;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_NAME = 120;

function validName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME) {
    throw new ValidationError(`Name is required and must be at most ${MAX_NAME} characters`, {
      field: 'name',
    });
  }
  return trimmed;
}

/**
 * User profile aggregate (users module). Credentials and lockout state live in
 * the auth module's AuthAccount — two views of the same row (ADR-0003).
 */
export class User extends AggregateRoot {
  private constructor(private props: UserProps) {
    super();
  }

  static invite(input: { id: string; email: string; name: string; role: Role; now: Date }, actor: ActorContext): User {
    const user = new User({
      id: input.id,
      email: Email.create(input.email),
      name: validName(input.name),
      role: input.role,
      status: 'invited',
      lastLoginAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    user.raise({
      type: 'user.invite',
      occurredAt: input.now,
      actorId: actor.userId,
      actorIp: actor.ip,
      target: { type: 'user', id: input.id },
      summary: { role: input.role },
    });
    return user;
  }

  static rehydrate(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get email(): Email {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get role(): Role {
    return this.props.role;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActiveAdmin(): boolean {
    return this.props.role === 'admin' && this.props.status === 'active';
  }

  update(patch: { name?: string; role?: Role }, now: Date, actor: ActorContext): void {
    if (this.props.status === 'deactivated') {
      throw new ConflictError('Deactivated users cannot be modified');
    }
    const changes: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = validName(patch.name);
      if (name !== this.props.name) {
        this.props.name = name;
        changes['name'] = true;
      }
    }
    if (patch.role !== undefined && patch.role !== this.props.role) {
      changes['role'] = { from: this.props.role, to: patch.role };
      this.props.role = patch.role;
    }
    if (Object.keys(changes).length === 0) return;
    this.props.updatedAt = now;
    this.raise({
      type: 'user.update',
      occurredAt: now,
      actorId: actor.userId,
      actorIp: actor.ip,
      target: { type: 'user', id: this.id },
      summary: changes,
    });
  }

  deactivate(now: Date, actor: ActorContext): void {
    if (this.props.status === 'deactivated') {
      throw new ConflictError('User is already deactivated');
    }
    this.props.status = 'deactivated';
    this.props.updatedAt = now;
    this.raise({
      type: 'user.deactivate',
      occurredAt: now,
      actorId: actor.userId,
      actorIp: actor.ip,
      target: { type: 'user', id: this.id },
      summary: {},
    });
  }

  toProps(): Readonly<UserProps> {
    return { ...this.props };
  }
}
