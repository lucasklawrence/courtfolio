/**
 * Server-only helpers for the dev-only movement-benchmarks write API
 * (PRD §7.3, §7.10). The actual API routes live under
 * `app/api/dev/movement-benchmarks/`; this module owns the Zod schema,
 * filesystem path, and read/write primitives so both the collection
 * (POST) and item (PUT/DELETE) routes stay thin.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

/** ISO calendar date in `YYYY-MM-DD` form. Matches `BenchmarkDate` from `types/movement.ts`. */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Zod schema for a complete {@link Benchmark}. Mirrors the type in
 * `types/movement.ts`; kept in sync manually since Zod is the runtime
 * source of truth (PRD §7.14) but the static type is the IDE source.
 *
 * `.strict()` rejects unknown fields so a typo in the payload (e.g.
 * `bodyweight_lb` instead of `bodyweight_lbs`) fails loudly instead of
 * silently dropping data into the JSON file.
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

/** Validated benchmark shape. `Inferred from {@link BenchmarkSchema}`. */
export type ValidatedBenchmark = z.infer<typeof BenchmarkSchema>

/** Validated partial update. Inferred from {@link BenchmarkUpdateSchema}. */
export type ValidatedBenchmarkUpdate = z.infer<typeof BenchmarkUpdateSchema>

/**
 * Absolute path to `public/data/movement_benchmarks.json`. The dev write
 * routes read and overwrite this file; the production site fetches it
 * statically.
 */
export const BENCHMARKS_FILE = path.join(process.cwd(), 'public', 'data', 'movement_benchmarks.json')

/**
 * Read the on-disk benchmark list. Returns `[]` if the file doesn't
 * exist yet (typical pre-baseline state) or if the file is empty —
 * those are normal "no data" conditions, not errors.
 *
 * @throws when the file exists but is malformed JSON or doesn't parse
 *   as a `Benchmark[]`.
 */
export async function readBenchmarks(): Promise<ValidatedBenchmark[]> {
  let raw: string
  try {
    raw = await fs.readFile(BENCHMARKS_FILE, 'utf8')
  } catch (err) {
    if (isFileNotFound(err)) return []
    throw err
  }
  const trimmed = raw.trim()
  if (trimmed === '') return []
  const parsed = JSON.parse(trimmed)
  return z.array(BenchmarkSchema).parse(parsed)
}

/**
 * Sort the list newest-first by date and write it back to disk.
 * Creates the parent `public/data/` directory if it doesn't exist so
 * the very first POST against an empty repo succeeds.
 *
 * @param list Validated benchmark entries to persist; mutated only via the local copy made before sort.
 * @throws Propagates filesystem errors from `mkdir`/`writeFile`.
 */
export async function writeBenchmarks(list: ValidatedBenchmark[]): Promise<void> {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))
  await fs.mkdir(path.dirname(BENCHMARKS_FILE), { recursive: true })
  // Trailing newline so the file plays nicely with `git diff` / editors.
  await fs.writeFile(BENCHMARKS_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
}

/**
 * True when this build is running under `next dev`. Both the route
 * 404-gate and any future feature flags should funnel through this
 * helper rather than re-checking the env var inline.
 */
export function isDevRuntime(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Validate a URL `[date]` segment as `YYYY-MM-DD`.
 *
 * @param value Raw string from the URL — typically `ctx.params.date`.
 * @returns `true` when `value` matches the ISO calendar-date shape.
 */
export function isValidDate(value: string): boolean {
  return DATE_REGEX.test(value)
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ENOENT'
}
