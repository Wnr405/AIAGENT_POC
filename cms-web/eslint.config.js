// @ts-check
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

/**
 * 04-ARCH §5.8 dependency rules (eslint-plugin-boundaries) + 05-METRICS §5/§6
 * reactive conformance and complexity limits.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'reports/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: { parserOptions: { project: ['./tsconfig.json'], tsconfigRootDir: import.meta.dirname } },
    plugins: { 'react-hooks': reactHooks, boundaries, sonarjs },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'design-system', pattern: 'src/design-system/**' },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['feature'] },
        { type: 'entry', pattern: 'src/main.tsx', mode: 'full' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'design-system', allow: ['design-system'] },
            { from: 'shared', allow: ['shared', 'design-system'] },
            { from: 'feature', allow: ['design-system', 'shared', ['feature', { feature: '${from.feature}' }]] },
            { from: 'app', allow: ['app', 'feature', 'shared', 'design-system'] },
            { from: 'entry', allow: ['app'] },
          ],
        },
      ],
      // 04-ARCH §5.5.2: side effects only in API gateway / storage wrappers.
      'no-restricted-globals': ['error', { name: 'localStorage', message: 'Use shared/utils/storage.ts' }, { name: 'sessionStorage', message: 'Use shared/utils/storage.ts' }],
      complexity: ['error', 12],
      'max-depth': ['error', 3],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'sonarjs/cognitive-complexity': ['error', 15],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': 'error',
      // `() => doSomething()` callbacks are idiomatic in JSX handlers; block bodies only where a value is confusingly returned.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    // Components may not fetch or touch storage directly (04-ARCH §5.6.2).
    files: ['src/**/components/**/*.tsx', 'src/design-system/**/*.tsx'],
    ignores: ['**/MediaPickerDialog.tsx', '**/ImageField.tsx'],
    rules: {
      // Type-only imports (DTO shapes, enums) are fine: they carry no behaviour.
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [{ group: ['**/api/*', '@tanstack/react-query', '**/stores/*'], message: 'Presentational components take props only (04-ARCH §5.6.2).', allowTypeImports: true }] }],
      'no-restricted-globals': ['error', 'fetch', 'localStorage', 'sessionStorage'],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', 'test/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', 'max-lines': 'off' },
  },
  {
    files: ['*.js', '*.cjs', '*.mjs', 'scripts/**'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { module: 'readonly', require: 'readonly', process: 'readonly', console: 'readonly' },
    },
  },
  { files: ['scripts/**'], rules: { 'no-console': 'off' } },
);
