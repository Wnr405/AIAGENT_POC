import type { DisplayStatus } from '../../../design-system/tokens/status';
import type { ContentStatus, ContentSummary, TransitionAction } from './content.types';

/** Status shown in chips: "Scheduled" is derived (03-DESIGN §6.2). Pure. */
export function displayStatus(c: Pick<ContentSummary, 'status' | 'scheduledAt'>): DisplayStatus {
  if (c.scheduledAt && (c.status === 'draft' || c.status === 'in_review')) return 'scheduled';
  return c.status;
}

/**
 * Which lifecycle actions to offer (02-SRS §5.4.1 + matrix §5.3.1). The API
 * enforces the same rules; this only avoids showing buttons that would fail.
 */
export function availableActions(status: ContentStatus, canPublish: boolean, isOwner: boolean): TransitionAction[] {
  const actions: TransitionAction[] = [];
  if (status === 'draft' && (isOwner || canPublish)) actions.push('submit');
  if (!canPublish) return actions;
  if (status === 'draft' || status === 'in_review') actions.push('publish');
  if (status === 'in_review') actions.push('reject');
  if (status === 'published') actions.push('unpublish');
  if (status === 'unpublished') actions.push('archive');
  return actions;
}

/** Mirrors FR-CONTENT-06 so the UI can explain why Publish is disabled. */
export function missingForPublish(input: { title: string; bodyText: string; seoDescription: string | null | undefined }): string[] {
  const missing: string[] = [];
  if (!input.title.trim()) missing.push('title');
  if (!input.bodyText.trim()) missing.push('body');
  const effective = input.seoDescription?.trim() || input.bodyText.trim();
  if (!effective) missing.push('meta description');
  return missing;
}

/** Plain text of a TipTap JSON doc (for SEO defaults and counters). */
export function docText(doc: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === 'text' && typeof node.text === 'string') out.push(node.text);
    node.content?.forEach(walk);
    if (node.type && node.type !== 'text' && node.type !== 'doc') out.push(' ');
  };
  walk(doc);
  return out.join('').replace(/\s+/g, ' ').trim();
}
