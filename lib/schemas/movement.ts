/**
 * Pure (isomorphic) Zod schemas for the movement-benchmark contract.
 *
 * Lives outside `lib/dev/` so the Combine entry form (a client component)
 * can import the schema for client-side validation without dragging in
 * the server-only `node:fs` helpers from the dev write store. The dev
 * store re-exports these symbols so existing route imports keep working.
 *
 * The Zod schema is the single source of truth for the on-disk JSON
 * shape (PRD §7.10, §7.14). The static `Benchmark` type in
 * `types/movement.ts` mirrors it for IDE ergonomics.
 */

import { z } from 'zod'

/** ISO calendar date in `YYYY-MM-DD` form. Matches `BenchmarkDate` from `types/movement.ts`. */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Zod schema for a complete benchmark entry. Mirrors the static
 * `Benchmark` interface in `types/movement.ts`.
 *
 * `.strict()` rejects unknown fields so a typo (e.g. `bodyweight_lb`
 * instead of `bodyweight_lbs`) fails loudly instead of silently dropping
 * data into the JSON file.
 */
export const BenchmarkSchema = z
  .object({
    date: z.string().regex(DATE_REGEX, 'date must be YYYY-MM-DD'),
    bodyweight_lbs: z.number().positive().optional(),
    shuttle_5_10_5_s: z.number().positive().optional(),
    vertical_in: z.number().positive().optional(),
    sprint_10y_s: z.number().positive().optional(),
    notes: z.string().optional(),
    is_complete: z.boolean().optional(),
  })
  .strict()

/**
 * Zod schema for the partial-update payload sent to PUT. The `date` is
 * the URL key and cannot be changed in-place, so it's omitted here.
 */
export const BenchmarkUpdateSchema = BenchmarkSchema.omit({ date: true }).partial().strict()

/** Validated benchmark shape inferred from {@link BenchmarkSchema}. */
export type ValidatedBenchmark = z.infer<typeof BenchmarkSchema>

/** Validated partial update inferred from {@link BenchmarkUpdateSchema}. */
export type ValidatedBenchmarkUpdate = z.infer<typeof BenchmarkUpdateSchema>

/**
 * Validate a string as a `YYYY-MM-DD` calendar date. Used by both the
 * route handler (URL `[date]` segment guard) and the entry form.
 *
 * @param value Raw string to validate.
 * @returns `true` when `value` matches the ISO calendar-date shape.
 */
export function isValidDate(value: string): boolean {
  return DATE_REGEX.test(value)
}
