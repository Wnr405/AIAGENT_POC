import type { ColorRoles } from './tokens';

/** 03-DESIGN §6.2 — semantic status chip colours. `scheduled` is derived (draft/in_review + scheduledAt). */
export type DisplayStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'unpublished' | 'archived';

export function statusColors(c: ColorRoles, s: DisplayStatus): { bg: string; fg: string; italic?: boolean } {
  switch (s) {
    case 'draft':
      return { bg: c.surfaceContainerHigh, fg: c.onSurfaceVariant };
    case 'in_review':
      return { bg: c.tertiaryContainer, fg: c.onTertiaryContainer };
    case 'scheduled':
      return { bg: c.secondaryContainer, fg: c.onSecondaryContainer };
    case 'published':
      return { bg: c.successContainer, fg: c.onSuccessContainer };
    case 'unpublished':
      return { bg: c.outlineVariant, fg: c.onSurfaceVariant };
    case 'archived':
      return { bg: c.surfaceContainer, fg: c.onSurfaceVariant, italic: true };
  }
}
