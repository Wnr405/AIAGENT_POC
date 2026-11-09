import type { Role } from './role';

/**
 * Permission matrix — 02-SRS §5.3.1. Single source of truth for RBAC.
 * "own only" capabilities are expressed as separate *_own / *_any entries;
 * ownership itself is checked by module policies.
 * CRITICAL PATH (05-METRICS §3.3): must stay at 100% line/branch coverage.
 */
export const CAPABILITIES = {
  'content.create': ['admin', 'editor', 'author'],
  'content.edit_own': ['admin', 'editor', 'author'],
  'content.edit_any': ['admin', 'editor'],
  'content.submit': ['admin', 'editor', 'author'],
  'content.publish': ['admin', 'editor'],
  'content.schedule': ['admin', 'editor'],
  'content.delete': ['admin', 'editor'],
  'content.read_drafts_any': ['admin', 'editor'],
  'media.upload': ['admin', 'editor', 'author'],
  'media.delete_own': ['admin', 'editor', 'author'],
  'media.delete_any': ['admin', 'editor'],
  'media.force_delete': ['admin'],
  'users.manage': ['admin'],
  'audit.read': ['admin'],
  'api_keys.manage': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}
