#!/usr/bin/env node
// 08-GIT-WORKFLOW §7: Conventional Commits + TDD prefixes. Used by the commit-msg hook and for PR titles.
// Usage: node harness/check-commit-msg.mjs <file-with-message>   |   --title "feat(content): add x"
//        node harness/check-commit-msg.mjs --range main..HEAD   (CI: every commit in the PR, hooks or not)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/**
 * One line per invalid commit: "<short sha>: <errors>". Merge commits are exempt (see validate).
 * @param {{ sha: string; message: string }[]} commits
 */
export function rangeProblems(commits) {
  return commits.flatMap(({ sha, message }) => {
    const errors = validate(message);
    return errors.length ? [`${sha.slice(0, 7)}: ${errors.join('; ')}`] : [];
  });
}

const FIELD = '\u001f';
const RECORD = '\u001e';

/** Commits in a git revision range, read without a shell (the range is passed as a single argument). */
function commitsIn(range) {
  const log = execFileSync('git', ['log', `--format=%H%x1f%B%x1e`, range], { encoding: 'utf8' });
  return log
    .split(RECORD)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha, message = ''] = r.split(FIELD);
      return { sha, message };
    });
}

function report(header, problems) {
  console.error(`✗ ${header} (08-GIT-WORKFLOW §7):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

function main(argv) {
  const at = (flag) => (argv.includes(flag) ? (argv[argv.indexOf(flag) + 1] ?? '') : undefined);
  const range = at('--range');
  if (range !== undefined) {
    const commits = commitsIn(range);
    const problems = rangeProblems(commits);
    if (problems.length) report(`${problems.length} commit(s) in ${range} rejected`, problems);
    console.log(`✓ ${commits.length} commit(s) in ${range} are Conventional Commits`);
    return;
  }
  const title = at('--title');
  const errors = validate(title ?? readFileSync(argv[2], 'utf8'));
  if (errors.length) report('commit message rejected', errors);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv);
