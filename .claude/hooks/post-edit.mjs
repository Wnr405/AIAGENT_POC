#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): instant architecture + debt feedback on the edited file,
// plus a TDD nudge. Exit 2 → Claude sees the violations and must fix them.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { addContext, block, projectDir, readEvent, relPath } from './_io.mjs';

const file = relPath(readEvent().tool_input?.file_path ?? '');
if (!/^cms-(api|web)\/(src|test)\/.*\.(ts|tsx)$/.test(file)) process.exit(0);

const run = (script) => spawnSync(process.execPath, [join(projectDir(), 'harness', script), file], { cwd: projectDir(), encoding: 'utf8' });
const problems = [run('check-architecture.mjs'), run('check-debt.mjs')].filter((r) => r.status !== 0).map((r) => `${r.stdout}${r.stderr}`.trim());
if (problems.length) block(`Harness check failed for ${file}:\n${problems.join('\n')}\nFix before continuing (04-ARCH §4.8 / 05-METRICS §6).`);

const isSpec = /\.spec\.tsx?$/.test(file);
const core = /^cms-api\/src\/(modules\/[^/]+\/(domain|application)|shared\/kernel)\//.test(file) || /^cms-web\/src\/.*(\.logic\.ts|\/streams\/)/.test(file);
if (!isSpec && core) {
  const spec = file.replace(/\.(tsx?)$/, '.spec.$1');
  const dirSpec = existsSync(join(projectDir(), spec));
  addContext(
    'PostToolUse',
    `TDD reminder (05-METRICS §2): ${file} is critical/business logic. ${dirSpec ? `Make sure ${spec}` : 'Make sure a co-located *.spec.ts'} has a failing test for this behaviour first (red → green → refactor), and cite the requirement ID (e.g. FR-CONTENT-04) in the test name.`,
  );
}
process.exit(0);
