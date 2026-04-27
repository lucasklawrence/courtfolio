/**
 * Server-only helpers for the dev-only movement-benchmarks write API
 * (PRD §7.3, §7.10). The actual API routes live under
 * `app/api/dev/movement-benchmarks/`; this module owns the filesystem
 * path and read/write primitives so both the collection (POST) and
 * item (PUT/DELETE) routes stay thin.
 *
 * The Zod contract (schemas, types, date helpers) lives in
 * `lib/schemas/movement.ts` so the Combine entry form (a client
 * component) can import it without pulling `node:fs` into the browser
 * bundle. Re-exported here so existing route imports stay stable.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

import { BenchmarkSchema } from '@/lib/schemas/movement'
import type { ValidatedBenchmark } from '@/lib/schemas/movement'

export {
  BenchmarkSchema,
  BenchmarkUpdateSchema,
  isValidDate,
  type ValidatedBenchmark,
  type ValidatedBenchmarkUpdate,
} from '@/lib/schemas/movement'

/**
 * Absolute path to the benchmarks JSON file the dev write routes read from
 * and overwrite. Defaults to `public/data/movement_benchmarks.json` — the
 * static asset the production site fetches.
 *
 * Tests override by stubbing `process.env.MOVEMENT_BENCHMARKS_FILE` so they
 * can point at a tmp dir instead of mutating the real fixture. Resolved at
 * call time (not module-load) so an env stub set in test setup actually
 * takes effect.
 */
export function getBenchmarksFile(): string {
  const override = process.env.MOVEMENT_BENCHMARKS_FILE
  if (override && override.length > 0) return override
  return path.join(process.cwd(), 'public', 'data', 'movement_benchmarks.json')
}

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
    raw = await fs.readFile(getBenchmarksFile(), 'utf8')
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
  await fs.mkdir(path.dirname(getBenchmarksFile()), { recursive: true })
  // Trailing newline so the file plays nicely with `git diff` / editors.
  await fs.writeFile(getBenchmarksFile(), JSON.stringify(sorted, null, 2) + '\n', 'utf8')
}

/**
 * True when this build is running under `next dev`. Both the route
 * 404-gate and any future feature flags should funnel through this
 * helper rather than re-checking the env var inline.
 */
export function isDevRuntime(): boolean {
  return process.env.NODE_ENV === 'development'
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ENOENT'
}
