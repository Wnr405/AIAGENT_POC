import { ValidationError } from '../../../shared/kernel/errors';

/**
 * SEC-05: SVGs may carry script. ADR-0011 chooses *rejection* over in-place
 * stripping: an SVG with any active or external content is refused, which is
 * strictly safer than a regex-based sanitizer. CRITICAL PATH.
 */
const FORBIDDEN: readonly { re: RegExp; reason: string }[] = [
  { re: /<script[\s>/]/i, reason: 'script element' },
  { re: /<foreignObject[\s>/]/i, reason: 'foreignObject element' },
  { re: /<!ENTITY/i, reason: 'XML entity declaration' },
  { re: /\son[a-z]+\s*=/i, reason: 'event handler attribute' },
  { re: /javascript\s*:/i, reason: 'javascript: URL' },
  { re: /data\s*:\s*text\/html/i, reason: 'HTML data URL' },
  { re: /(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i, reason: 'external reference' },
  { re: /<(?:iframe|embed|object|audio|video)[\s>/]/i, reason: 'embedded content' },
  { re: /@import|url\(\s*["']?\s*(?:https?:)?\/\//i, reason: 'external stylesheet reference' },
];

export function assertSafeSvg(svgText: string): void {
  const hit = FORBIDDEN.find((f) => f.re.test(svgText));
  if (hit) {
    throw new ValidationError(`SVG rejected: contains ${hit.reason}`, { field: 'file', reason: hit.reason });
  }
}
