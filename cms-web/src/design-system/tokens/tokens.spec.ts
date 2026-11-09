import { describe, expect, it } from 'vitest';
import { statusColors, type DisplayStatus } from './status';
import { colorDark, colorLight, type ColorRoles } from './tokens';

/** WCAG 2.1 relative luminance / contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const STATUSES: DisplayStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'unpublished', 'archived'];
const PAIRS: [keyof ColorRoles, keyof ColorRoles][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onErrorContainer', 'errorContainer'],
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['inverseOnSurface', 'inverseSurface'],
];

describe('MD3 tokens meet WCAG 2.1 AA (NFR-USE-03, 03-DESIGN §6.4)', () => {
  for (const [name, palette] of [
    ['light', colorLight],
    ['dark', colorDark],
  ] as const) {
    it.each(PAIRS)(`${name}: %s on %s ≥ 4.5:1`, (fg: keyof ColorRoles, bg: keyof ColorRoles) => {
      expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
    });
    it.each(STATUSES)(`${name}: status chip %s text ≥ 4.5:1`, (s: DisplayStatus) => {
      const { fg, bg } = statusColors(palette, s);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('archived chips are italic; others are not', () => {
    expect(STATUSES.filter((s) => statusColors(colorLight, s).italic)).toEqual(['archived']);
  });
});
