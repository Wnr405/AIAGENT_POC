import type { ContentStatus } from '../value-objects/content-status';

/**
 * Lifecycle state machine — 02-SRS §5.4.1. CRITICAL PATH.
 *
 *   draft ──submit──▶ in_review ──publish──▶ published ──unpublish──▶ unpublished ──archive──▶ archived
 *     ▲                  │ reject                                         │ edit
 *     └──────────────────┴────────────────────────────────────────────────┘
 *   draft ──publish──▶ published   (Editors/Admins only — enforced by the application policy)
 */
export type LifecycleAction = 'submit' | 'reject' | 'publish' | 'unpublish' | 'archive' | 'edit_back_to_draft';

const TRANSITIONS: Record<LifecycleAction, { from: readonly ContentStatus[]; to: ContentStatus }> = {
  submit: { from: ['draft'], to: 'in_review' },
  reject: { from: ['in_review'], to: 'draft' },
  publish: { from: ['draft', 'in_review'], to: 'published' },
  unpublish: { from: ['published'], to: 'unpublished' },
  archive: { from: ['unpublished'], to: 'archived' },
  edit_back_to_draft: { from: ['unpublished'], to: 'draft' },
};

/** Returns the target status, or null if the action is not allowed from `from`. */
export function nextStatus(from: ContentStatus, action: LifecycleAction): ContentStatus | null {
  const t = TRANSITIONS[action];
  return t.from.includes(from) ? t.to : null;
}

/** Statuses from which scheduling a future publish is allowed. */
export const SCHEDULABLE: readonly ContentStatus[] = ['draft', 'in_review'];
