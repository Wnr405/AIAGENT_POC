import { can } from '../../../../shared/kernel/permissions';
import { ForbiddenError } from '../../../../shared/kernel/errors';
import type { ActorContext } from '../../../../shared/kernel/actor';
import type { Content } from '../../domain/entities/content.entity';
import type { TransitionAction } from '../ports/in/content.ports';

/**
 * Content authorization (FR-AUTHZ-02/03/04, matrix §5.3.1). CRITICAL PATH.
 * Every use case calls one of these before touching the aggregate.
 */
const isOwner = (actor: ActorContext, c: Content): boolean => c.authorId === actor.userId;

export const ContentAccessPolicy = {
  /** Authors see their own items in any status, others' only when published. */
  assertCanView(actor: ActorContext, c: Content): void {
    if (can(actor.role, 'content.read_drafts_any') || isOwner(actor, c) || c.status === 'published') return;
    throw new ForbiddenError();
  },

  assertCanEdit(actor: ActorContext, c: Content): void {
    if (can(actor.role, 'content.edit_any')) return;
    if (can(actor.role, 'content.edit_own') && isOwner(actor, c)) return;
    throw new ForbiddenError();
  },

  assertCanTransition(actor: ActorContext, c: Content, action: TransitionAction): void {
    if (action === 'submit') {
      if (can(actor.role, 'content.submit') && (isOwner(actor, c) || can(actor.role, 'content.edit_any'))) return;
      throw new ForbiddenError();
    }
    if (!can(actor.role, 'content.publish')) throw new ForbiddenError();
  },

  assertCanSchedule(actor: ActorContext): void {
    if (!can(actor.role, 'content.schedule')) throw new ForbiddenError();
  },

  assertCanDelete(actor: ActorContext): void {
    if (!can(actor.role, 'content.delete')) throw new ForbiddenError();
  },

  /** FR-AUTHZ-02: authors are always scoped to their own items, regardless of query params. */
  listScope(actor: ActorContext, requestedAuthorId: string | undefined): string | undefined {
    return can(actor.role, 'content.read_drafts_any') ? requestedAuthorId : actor.userId;
  },
};
