import type { ActorContext } from '../../../../../shared/kernel/actor';
import type { PagedResult } from '../../../../../shared/kernel/paged-result';
import type { Role } from '../../../../../shared/kernel/role';
import type { UserStatus } from '../../../domain/user.entity';

export interface UserView {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
}

export interface InviteUserCommand {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}
export interface InviteUserUseCase {
  execute(cmd: InviteUserCommand, actor: ActorContext): Promise<UserView>;
}

export interface UpdateUserCommand {
  readonly userId: string;
  readonly name?: string;
  readonly role?: Role;
}
export interface UpdateUserUseCase {
  execute(cmd: UpdateUserCommand, actor: ActorContext): Promise<UserView>;
}

export interface DeactivateUserUseCase {
  execute(userId: string, actor: ActorContext): Promise<UserView>;
}

export interface ListUsersQuery {
  readonly search?: string;
  readonly role?: Role;
  readonly status?: UserStatus;
  readonly page?: number;
  readonly pageSize?: number;
}
export interface ListUsersUseCase {
  execute(query: ListUsersQuery, actor: ActorContext): Promise<PagedResult<UserView>>;
}

export interface GetUserUseCase {
  /** Admins may read anyone; others only themselves. */
  execute(userId: string, actor: ActorContext): Promise<UserView>;
}

export interface AdminResetPasswordUseCase {
  execute(userId: string, actor: ActorContext): Promise<void>;
}
