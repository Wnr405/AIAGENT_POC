import type { Role } from './role';
import { ForbiddenError } from './errors';
import { can, type Capability } from './permissions';

/** Who is performing an action. Built by driving adapters from the JWT. */
export interface ActorContext {
  readonly userId: string;
  readonly role: Role;
  readonly ip: string;
}

/** System actor for scheduled jobs (no user id). */
export interface SystemContext {
  readonly userId: null;
  readonly role: 'system';
  readonly ip: string;
}

export type AnyActor = ActorContext | SystemContext;

export const SYSTEM_ACTOR: SystemContext = { userId: null, role: 'system', ip: '127.0.0.1' };

export function requireCapability(actor: ActorContext, capability: Capability): void {
  if (!can(actor.role, capability)) throw new ForbiddenError();
}
