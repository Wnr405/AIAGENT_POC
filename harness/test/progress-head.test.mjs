// Session state layer (05-METRICS §11 evidence, 08-GIT-WORKFLOW handover): session-start shows the head of
// cms-docs/progress.md so every session resumes from the recorded requirement, status, evidence and next step.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { progressHead, PROGRESS_HEAD_END } from '../../.claude/hooks/_progress.mjs';

test('G-01: progress head is everything above the end-of-head marker', () => {
  const doc = `# Progress\n\n- Current: FR-AUTH-06\n- Next: review\n${PROGRESS_HEAD_END}\n\n## Log\n- old entry`;
  assert.equal(progressHead(doc), '# Progress\n\n- Current: FR-AUTH-06\n- Next: review');
});

test('G-01: without a marker the head falls back to the first 20 lines', () => {
  const doc = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
  assert.equal(progressHead(doc).split('\n').length, 20);
  assert.equal(progressHead(doc).split('\n').at(-1), 'line 20');
});

test('G-01: a missing progress file yields a hint instead of a crash', () => {
  assert.match(progressHead(undefined), /cms-docs\/progress\.md/);
});

test('G-01: Windows line endings are normalised', () => {
  assert.equal(progressHead(`# Progress\r\n- Status: green\r\n${PROGRESS_HEAD_END}\r\n`), '# Progress\n- Status: green');
});

test('G-01: an empty head (marker on the first line, or an empty file) yields a hint, not a blank section', () => {
  assert.match(progressHead(`${PROGRESS_HEAD_END}\n## Log`), /head is empty/);
  assert.match(progressHead(''), /head is empty/);
});

test('G-01: only the first end-of-head marker counts', () => {
  assert.equal(progressHead(`- a\n${PROGRESS_HEAD_END}\n- b\n${PROGRESS_HEAD_END}`), '- a');
});
