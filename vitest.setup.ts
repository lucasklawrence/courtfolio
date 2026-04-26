/**
 * Vitest global setup — extends `expect` with `@testing-library/jest-dom`
 * matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) so component tests
 * added in follow-up PRs read naturally without per-file imports.
 */
import '@testing-library/jest-dom/vitest'
