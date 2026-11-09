#!/usr/bin/env node
// 08-GIT-WORKFLOW §7: Conventional Commits + TDD prefixes. Used by the commit-msg hook and for PR titles.
// Usage: node harness/check-commit-msg.mjs <file-with-message>   |   --title "feat(content): add x"
import { readFileSync } from 'node:fs';

const TYPES = ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'revert', 'red', 'green'];
const SCOPES = ['auth', 'users', 'content', 'media', 'audit', 'public-api', 'notifications', 'shared', 'infra', 'ci', 'docs', 'web', 'api', 'harness', 'deps'];

export function validate(message) {
  const subject = message.split('\n')[0] ?? '';
  if (/^(Merge|Revert ")/.test(subject)) return [];
  const m = subject.match(/^(\w+)(?:\(([a-z0-9-]+)\))?(!)?: (.+)$/);
  if (!m) return [`"${subject}" is not a Conventional Commit: <type>(<scope>): <subject>`];
  const [, type, scope, , text] = m;
  const errors = [];
  if (!TYPES.includes(type)) errors.push(`unknown type "${type}" (allowed: ${TYPES.join(', ')})`);
  if (scope && !SCOPES.includes(scope)) errors.push(`unknown scope "${scope}" (allowed: ${SCOPES.join(', ')})`);
  if (subject.length > 72) errors.push(`subject is ${subject.length} chars (max 72)`);
  if (/\.$/.test(text)) errors.push('no trailing period');
  if (/^[A-Z]/.test(text)) errors.push('lower-case first letter after the colon');
  if (/^(added|adds|fixed|fixes|updated|updates)\b/i.test(text)) errors.push('use the imperative mood ("add", not "added")');
  return errors;
}

const i = process.argv.indexOf('--title');
const msg = i > -1 ? process.argv[i + 1] ?? '' : readFileSync(process.argv[2], 'utf8');
const errors = validate(msg);
if (errors.length) {
  console.error(`✗ commit message rejected (08-GIT-WORKFLOW §7):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
