#!/usr/bin/env node
// PreToolUse(Bash): enforce 08-GIT-WORKFLOW and protect secrets/data. Exit 2 = blocked.
import { execSync } from 'node:child_process';
import { ask, block, projectDir, readEvent } from './_io.mjs';

const cmd = String(readEvent().tool_input?.command ?? '');
const has = (re) => re.test(cmd);
const branch = () => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

if (has(/--no-verify\b|\bcommit\b[^|;&]*\s-n\b|HUSKY=0/)) block('Blocked: skipping git hooks bypasses gate G-01/G-02 (05-METRICS §11). Fix the failing check instead.');
if (has(/\bgit\s+push\b[^|;&]*(--force(?!-with-lease)|\s-f\b)/)) block('Blocked: force-push is not allowed (08-GIT-WORKFLOW §4.4). Use --force-with-lease on your own short-lived branch only.');
if (has(/\bgit\s+push\b[^|;&]*\b(origin\s+)?(main|master)\b/)) block('Blocked: main only changes through a reviewed, squash-merged PR (08-GIT-WORKFLOW §10).');
if (has(/\bgit\s+commit\b/) && ['main', 'master'].includes(branch())) {
  block('Blocked: you are on main. Create a short-lived branch first: git switch -c feature/<scope>-<short> (08-GIT-WORKFLOW §3.2).');
}
if (has(/(^|[\s;&|])(cat|less|more|head|tail|type|bat|grep|rg)\b[^|;&]*\.env(\.(local|production|staging))?\b(?!\.example)/)) {
  block('Blocked: .env files hold secrets and must not be read into the conversation (07-OPS-ARCH §7.6). Use .env.example.');
}
if (has(/\bprisma\s+migrate\s+reset\b|\bdocker\s+compose\b[^|;&]*\bdown\b[^|;&]*(-v|--volumes)\b|\bDROP\s+(DATABASE|TABLE|SCHEMA)\b|\bTRUNCATE\b/i)) {
  ask('This destroys database data. Confirm only for a disposable local environment.');
}
if (has(/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.|restore\s+\.)/) || has(/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.\.?)(\s|$)/)) {
  ask('This discards work irreversibly. Confirm it is intended.');
}
if (has(/\bnpm\s+(i|install)\b|\byarn\s+add\b/)) block('Use pnpm (packageManager is pinned): pnpm add <pkg> --filter <cms-api|cms-web>.');
process.exit(0);
