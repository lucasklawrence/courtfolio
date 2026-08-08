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
  {
    // The domain layer must not import from the component layer (#425).
    //
    // Nine modules here used to import `startOfDay` and the `DateRange` type
    // from `DateFilter.tsx` — a `'use client'` React component — because that
    // is where the helpers happened to be defined. It typechecked and it
    // worked, and it also meant the domain layer's import graph contained a
    // React component. The helpers now live in `lib/training-facility/
    // date-range.ts`; this rule is what stops the next convenient definition
    // from recreating the inversion.
    //
    // Scoped to `lib/**` only: components importing from `lib/` is the correct
    // direction and stays unrestricted.
    files: ['lib/**/*.ts', 'lib/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/*', '@/components/**'],
              message:
                'The domain layer must not import from components. Move the shared value into lib/ (see lib/training-facility/date-range.ts) and have the component import it instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // The strength modules must reach the calendar through a `DayClock`, not
    // through the Pacific-bound shim (#429).
    //
    // `day-keys.ts` still exists and is still correct for the surfaces that are
    // legitimately Pacific-only — the data layer, the admin routes, the
    // components. But these modules are the ones heading for a shared package,
    // where hardcoding one home timezone is the bug. Importing the shim here
    // would re-hardwire Pacific in a way no test in this repo could see, since
    // this repo *is* Pacific.
    //
    // Scoped to the shipping set rather than all of `lib/**`, so the shim stays
    // freely available everywhere it's still the right answer.
    files: [
      'lib/training-facility/achievements.ts',
      'lib/training-facility/exercise-progression.ts',
      'lib/training-facility/load-management.ts',
      'lib/training-facility/monthly-focus.ts',
      'lib/training-facility/strength-streaks.ts',
      'lib/training-facility/strength-today.ts',
      'lib/training-facility/weight-room-history.ts',
      'lib/training-facility/workout-sessions.ts',
      'lib/training-facility/workout-stats.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/day-keys', '@/lib/training-facility/day-keys'],
              message:
                'Import from ./clock and take a DayClock parameter instead. day-keys.ts is the Pacific-bound shim; these modules ship in a package where the zone is the caller’s choice.',
            },
            {
              group: ['@/components/*', '@/components/**'],
              message: 'The domain layer must not import from components.',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
