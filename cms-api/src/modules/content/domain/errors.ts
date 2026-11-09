import { ConflictError, ValidationError } from '../../../shared/kernel/errors';
import type { ContentStatus } from './value-objects/content-status';

/** FR-CONTENT-04 → HTTP 409 */
export class InvalidTransitionError extends ConflictError {
  constructor(from: ContentStatus, action: string) {
    super(`Cannot ${action} content in status "${from}"`, { from, action });
  }
}

/** FR-CONTENT-03 → HTTP 409 with field detail */
export class SlugConflictError extends ConflictError {
  constructor(slug: string) {
    super('Slug already exists for this content type', { field: 'slug', slug });
  }
}

/** FR-CONTENT-06 → HTTP 422 listing every unmet requirement */
export class PublishRequirementsError extends ValidationError {
  constructor(missing: readonly string[]) {
    super(`Content is not ready to publish: ${missing.join(', ')}`, { missing });
  }
}
