import type { ContentSnapshot } from './content.entity';

/** FR-CONTENT-08: immutable snapshot taken on every save. */
export interface ContentVersion {
  readonly id: string;
  readonly contentId: string;
  readonly versionNo: number;
  readonly snapshot: ContentSnapshot;
  readonly editorId: string | null;
  readonly createdAt: Date;
}

/** §6.4: keep the last 50 versions per item. */
export const MAX_VERSIONS_PER_CONTENT = 50;
