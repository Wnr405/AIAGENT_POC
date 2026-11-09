import { requireCapability, type ActorContext } from '../../../../shared/kernel/actor';
import { Email } from '../../../../shared/kernel/email.vo';
import { ForbiddenError, NotFoundError } from '../../../../shared/kernel/errors';
import { mapPaged, pageRequest, type PagedResult } from '../../../../shared/kernel/paged-result';
import type { Clock } from '../../../../shared/ports/clock.port';
import type { DomainEventPublisher } from '../../../../shared/ports/event-publisher.port';
import type { IdGenerator } from '../../../../shared/ports/id-generator.port';
import type { TransactionRunner } from '../../../../shared/ports/transaction-runner.port';
import { User } from '../../domain/user.entity';
import { EmailTakenError, LastAdminError } from '../../domain/user-errors';
import type {
  AdminResetPasswordUseCase,
  DeactivateUserUseCase,
  GetUserUseCase,
  InviteUserCommand,
  InviteUserUseCase,
  ListUsersQuery,
  ListUsersUseCase,
  UpdateUserCommand,
  UpdateUserUseCase,
  UserView,
} from '../ports/in/users.ports';
import type { UserInvitationNotifier } from '../ports/out/user-invitation-notifier.port';
import type { UserRepository } from '../ports/out/user-repository.port';
import { toUserView } from './user-view';

export interface UsersDeps {
  readonly users: UserRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly events: DomainEventPublisher;
  readonly tx: TransactionRunner;
  readonly notifier: UserInvitationNotifier;
}

async function loadUser(users: UserRepository, id: string): Promise<User> {
  const user = await users.findById(id);
  if (!user) throw new NotFoundError('User', id);
  return user;
}

/** FR-USER-04: refuse a change that would leave zero active admins. */
async function guardLastAdmin(users: UserRepository, target: User): Promise<void> {
  if (target.isActiveAdmin() && (await users.countActiveAdmins()) <= 1) {
    throw new LastAdminError();
  }
}

/** UR-A01, FR-USER-01/02/07/08 */
export class InviteUser implements InviteUserUseCase {
  constructor(private readonly d: UsersDeps) {}

  async execute(cmd: InviteUserCommand, actor: ActorContext): Promise<UserView> {
    requireCapability(actor, 'users.manage');
    const email = Email.create(cmd.email);
    const user = await this.d.tx.run(async () => {
      if (await this.d.users.findByEmail(email.value)) throw new EmailTakenError();
      const created = User.invite(
        { id: this.d.ids.next(), email: email.value, name: cmd.name, role: cmd.role, now: this.d.clock.now() },
        actor,
      );
      await this.d.users.save(created);
      return created;
    });
    await this.d.events.publishAll(user.pullDomainEvents());
    await this.d.notifier.invitationCreated({ id: user.id, email: user.email.value, name: user.name });
    return toUserView(user);
  }
}

/** UR-A02 */
export class UpdateUser implements UpdateUserUseCase {
  constructor(private readonly d: UsersDeps) {}

  async execute(cmd: UpdateUserCommand, actor: ActorContext): Promise<UserView> {
    requireCapability(actor, 'users.manage');
    const user = await this.d.tx.run(async () => {
      const target = await loadUser(this.d.users, cmd.userId);
      if (cmd.role !== undefined && cmd.role !== 'admin') await guardLastAdmin(this.d.users, target);
      target.update({ name: cmd.name, role: cmd.role }, this.d.clock.now(), actor);
      await this.d.users.save(target);
      return target;
    });
    await this.d.events.publishAll(user.pullDomainEvents());
    return toUserView(user);
  }
}

/** UR-A03, FR-USER-05 — auth module revokes sessions on `user.deactivate`. */
export class DeactivateUser implements DeactivateUserUseCase {
  constructor(private readonly d: UsersDeps) {}

  async execute(userId: string, actor: ActorContext): Promise<UserView> {
    requireCapability(actor, 'users.manage');
    const user = await this.d.tx.run(async () => {
      const target = await loadUser(this.d.users, userId);
      await guardLastAdmin(this.d.users, target);
      target.deactivate(this.d.clock.now(), actor);
      await this.d.users.save(target);
      return target;
    });
    await this.d.events.publishAll(user.pullDomainEvents());
    return toUserView(user);
  }
}

/** FR-USER-06 */
export class ListUsers implements ListUsersUseCase {
  constructor(private readonly d: Pick<UsersDeps, 'users'>) {}

  async execute(query: ListUsersQuery, actor: ActorContext): Promise<PagedResult<UserView>> {
    requireCapability(actor, 'users.manage');
    const page = pageRequest(query.page, query.pageSize);
    const result = await this.d.users.findMany({ search: query.search, role: query.role, status: query.status }, page);
    return mapPaged(result, toUserView);
  }
}

export class GetUser implements GetUserUseCase {
  constructor(private readonly d: Pick<UsersDeps, 'users'>) {}

  async execute(userId: string, actor: ActorContext): Promise<UserView> {
    if (actor.userId !== userId && actor.role !== 'admin') throw new ForbiddenError();
    return toUserView(await loadUser(this.d.users, userId));
  }
}

/** UR-A05: admin triggers a reset email for another user. */
export class AdminResetPassword implements AdminResetPasswordUseCase {
  constructor(private readonly d: Pick<UsersDeps, 'users' | 'notifier' | 'events' | 'clock'>) {}

  async execute(userId: string, actor: ActorContext): Promise<void> {
    requireCapability(actor, 'users.manage');
    const user = await loadUser(this.d.users, userId);
    if (user.status === 'deactivated') throw new ForbiddenError('User is deactivated');
    const ref = { id: user.id, email: user.email.value, name: user.name };
    // An invited user who never set a password gets a fresh invite ("Resend invite").
    if (user.status === 'invited') await this.d.notifier.invitationCreated(ref);
    else await this.d.notifier.passwordResetRequestedByAdmin(ref);
    await this.d.events.publishAll([
      {
        type: 'user.password_reset_by_admin',
        occurredAt: this.d.clock.now(),
        actorId: actor.userId,
        actorIp: actor.ip,
        target: { type: 'user', id: user.id },
        summary: {},
      },
    ]);
  }
}
