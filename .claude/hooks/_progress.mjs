// Head of cms-docs/progress.md for the SessionStart hook — pure, unit-tested in harness/test.
export const PROGRESS_FILE = 'cms-docs/progress.md';
export const PROGRESS_HEAD_END = '<!-- progress:end-head -->';
const FALLBACK_LINES = 20;

/** Lines above PROGRESS_HEAD_END (or the first 20 lines); a hint when the file is missing. */
export function progressHead(text) {
  if (text === undefined) return `(no ${PROGRESS_FILE} yet — create it from the template in /feature step 8)`;
  const normalised = text.replace(/\r\n/g, '\n');
  const end = normalised.indexOf(PROGRESS_HEAD_END);
  const head = end >= 0 ? normalised.slice(0, end) : normalised.split('\n').slice(0, FALLBACK_LINES).join('\n');
  const trimmed = head.trimEnd();
  return trimmed === '' ? `(${PROGRESS_FILE} head is empty — fill it in per /feature step 8)` : trimmed;
}
