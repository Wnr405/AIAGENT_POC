import { describe, expect, it } from 'vitest';
import { lastModified } from './public.presenter';

describe('public presenter (FR-PUBAPI-04)', () => {
  it('Last-Modified is the newest updatedAt on the page, or null when empty', () => {
    const older = { updatedAt: new Date('2026-01-01T00:00:00Z') };
    const newer = { updatedAt: new Date('2026-02-01T00:00:00Z') };
    expect(lastModified([newer, older])).toEqual(newer.updatedAt);
    expect(lastModified([older, newer])).toEqual(newer.updatedAt);
    expect(lastModified([])).toBeNull();
  });
});
