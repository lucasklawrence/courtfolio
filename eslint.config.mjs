import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * ESLint flat config (ESLint 10 / Next 16).
 *
 * Replaces the legacy `.eslintrc.json` that `next lint` consumed: `next lint`
 * was removed in Next 16, so linting now runs through the ESLint CLI (`eslint .`).
 * Composes Next's native flat presets — `core-web-vitals` (React / a11y / Next
 * rules) and `typescript` (typescript-eslint) — then globally ignores build
 * output, coverage, and tooling directories.
 *
 * One deliberate deviation from the presets is documented inline below:
 *  - `settings.react.version` is pinned to work around an ESLint 10 crash in the
 *    preset's bundled `eslint-plugin-react`. This is an upstream blocker, so the
 *    pin stays until `eslint-config-next` supports ESLint 10 (#292).
 *
 * The migration's temporary `warn` downgrades have been burned down and every
 * rule is restored to `error` (#292).
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  // eslint-config-next@16 bundles eslint-plugin-react@7.37.5, whose peer range
  // caps at `eslint ^9.7`. ESLint 10 removed the deprecated `context.getFilename()`
  // that the plugin's React-version auto-detection calls, so linting crashes with
  // "context.getFilename is not a function". Pinning the version here skips that
  // auto-detection codepath. Remove once eslint-config-next (and its bundled
  // eslint-plugin-react) officially support ESLint 10 — an upstream blocker
  // intentionally left in place; see #292 for context.
  { settings: { react: { version: '19' } } },
  {
    ignores: [
      '.next/**',
      '.next-e2e-default/**',
      '.next-e2e-training-facility/**',
      'coverage/**',
      '.claude/**',
    ],
  },
  {
    // Honor the leading-underscore convention for intentionally-unused bindings:
    // destructuring-omit idioms (`const { key: _omit, ...rest } = obj`), unused
    // callback params kept for signature shape (`(_req, _ctx) => ...`), and
    // caught errors that are deliberately swallowed. The Next preset's
    // `no-unused-vars` doesn't set these patterns, so `_`-prefixed names were
    // being flagged despite the convention.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // These rules were temporarily lowered to `warn` when `eslint .` first ran
    // across the whole repo (#289) so the Next 16 migration could land on a green
    // baseline. The backlog has since been burned down (#292), so each is
    // restored to `error` and enforced. Kept explicit — rather than deleting the
    // block to inherit preset defaults — so the enforcement intent is documented
    // and survives future preset-default changes.
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'react/no-unescaped-entities': 'error',
      'react/display-name': 'error',
      'prefer-const': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
    },
  },
]

export default eslintConfig
