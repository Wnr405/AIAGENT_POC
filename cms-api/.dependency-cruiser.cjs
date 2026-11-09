/**
 * 04-ARCH §4.8 dependency rules, enforced in CI (gate G-03, metrics M-HEX-01..04)
 * and by the Claude Code PostToolUse hook. Any violation fails the build.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'Domain knows nothing external: no framework, no adapters, no application, no npm packages.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        pathNot: ['^src/modules/[^/]+/domain/', '^src/shared/kernel/'],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'domain-no-npm',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+/domain|shared/kernel)/', pathNot: '\\.spec\\.ts$' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'] },
    },
    {
      name: 'application-not-to-adapters',
      comment: 'Application talks to the outside world only through ports.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/', pathNot: '\\.spec\\.ts$' },
      to: { path: ['/adapters/', '^src/composition/', '^src/shared/adapters/', '^src/shared/http/'] },
    },
    {
      name: 'application-no-framework',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/', pathNot: '\\.spec\\.ts$' },
      to: { path: 'node_modules', pathNot: 'node_modules/zod/' },
    },
    {
      name: 'inbound-adapters-not-to-domain-internals',
      comment: 'adapters/in call use cases; they never construct entities (enums/constants allowed via value-objects).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/adapters/in/' },
      to: { path: '^src/modules/[^/]+/domain/(entities|services)/' },
    },
    {
      name: 'inbound-not-to-outbound',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/adapters/in/' },
      to: { path: '^src/modules/[^/]+/adapters/out/', pathNot: 'in-memory-object-storage' },
    },
    {
      name: 'no-cross-module-internals',
      comment: 'Module A may not import module B. Cross-module wiring happens only in src/composition.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/', pathNot: '\\.spec\\.ts$' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/'] },
    },
    {
      name: 'shared-not-to-modules',
      severity: 'error',
      from: { path: '^src/shared/', pathNot: ['^src/shared/http/', '\\.spec\\.ts$'] },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-test-code-in-production',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.spec\\.ts$' },
      to: { path: '^test/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.spec\\.ts$' },
  },
};
