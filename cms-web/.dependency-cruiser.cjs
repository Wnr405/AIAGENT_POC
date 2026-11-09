/** 04-ARCH §5.8 — same rules as eslint-plugin-boundaries, plus cycle detection (M-RX-*). */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'design-system-is-leaf', severity: 'error', from: { path: '^src/design-system/' }, to: { path: '^src/(shared|features|app)/' } },
    { name: 'shared-not-to-features', severity: 'error', from: { path: '^src/shared/' }, to: { path: '^src/(features|app)/' } },
    {
      name: 'no-cross-feature',
      comment: 'feature A → feature B is forbidden; go through shared/ or routing.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    { name: 'features-not-to-app', severity: 'error', from: { path: '^src/features/' }, to: { path: '^src/app/' } },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' }, exclude: { path: '\\.spec\\.tsx?$' } },
};
