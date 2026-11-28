// G-03 security job (05-METRICS §11.4): `pnpm audit` matches advisories by package name, so an
// unscoped workspace name (`cms-web`) collides with whatever public npm package squats it — and a
// registry lookup could even resolve it (dependency confusion). Workspace packages live in the
// private `@cms/` scope and stay `private: true`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../../', import.meta.url);
const workspaceDirs = readFileSync(new URL('pnpm-workspace.yaml', ROOT), 'utf8')
  .split('\n')
  .map((l) => /^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/.exec(l)?.[1])
  .filter(Boolean);
const manifestOf = (dir) => JSON.parse(readFileSync(new URL(`${dir}/package.json`, ROOT), 'utf8'));

test('G-03: pnpm-workspace.yaml lists the workspace packages', () => {
  assert.deepEqual(workspaceDirs, ['cms-api', 'cms-web']);
});

for (const dir of workspaceDirs) {
  test(`G-03: workspace package ${dir} is private and named @cms/${dir.replace(/^cms-/, '')}`, () => {
    const pkg = manifestOf(dir);
    assert.equal(pkg.name, `@cms/${dir.replace(/^cms-/, '')}`);
    assert.equal(pkg.private, true);
  });
}
