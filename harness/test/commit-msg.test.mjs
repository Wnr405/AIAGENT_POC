// G-03 (05-METRICS §11.4) + 08-GIT-WORKFLOW §7: CI must reject non-Conventional commits in a PR,
// not only the PR title — the local commit-msg hook is skipped when hooks are not installed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rangeProblems, validate } from '../check-commit-msg.mjs';

test('G-03: importing the checker does not run the CLI', () => {
  assert.equal(typeof validate, 'function');
});

test('G-03: a commit with a non-Conventional subject is reported with its short sha', () => {
  const problems = rangeProblems([
    { sha: 'e3ee8013a6b2', message: 'message' },
    { sha: '5b7cf56bc057', message: 'fix(harness): fail full gate on dependency skips\n\nbody' },
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^e3ee801: .*not a Conventional Commit/);
});

test('G-03: a range of valid commits, merge commits included, has no problems', () => {
  const ok = [
    { sha: 'aaaaaaa1', message: 'feat(content): add scheduling' },
    { sha: 'bbbbbbb2', message: 'Merge 1234abc into 5678def' },
  ];
  assert.deepEqual(rangeProblems(ok), []);
});

test('G-03: an empty range has no problems', () => {
  assert.deepEqual(rangeProblems([]), []);
});
