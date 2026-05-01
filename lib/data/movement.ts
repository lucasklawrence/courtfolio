import { z } from 'zod'

import { BenchmarkSchema } from '@/lib/schemas/movement'
import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import type {
  Benchmark,
  BenchmarkDate,
  BenchmarkUpdate,
} from '@/types/movement'

/** Admin-only API route prefix for benchmark writes (#131). */
const WRITE_ROUTE = '/api/admin/movement-benchmarks'

/** Supabase table containing benchmark rows. Created via migration in #131. */
const TABLE = 'movement_benchmarks'

/**
 * Whitelisted column list for benchmark reads. Mirrors the {@link Benchmark}
 * shape so a future column addition (e.g. a `bench_press_lbs` field) doesn't
 * silently leak through to consumers without a corresponding type update.
 */
const SELECT_COLUMNS =
  'date, bodyweight_lbs, shuttle_5_10_5_s, vertical_in, sprint_10y_s, notes, is_complete'

/**
 * Validates an array of rows returned from the Supabase select. Each
 * row is normalized (null → omitted) and then run through the
 * canonical {@link BenchmarkSchema} so a DB-shape drift (e.g. a
 * future column added without updating the type, or a hand-edited
 * malformed row) surfaces as a loud error instead of silently flowing
 * into the public UI.
 */
const BenchmarkRowsSchema = z
  .array(BenchmarkSchema)
  .describe('movement_benchmarks rows after null-stripping')

/**
 * Fetch all logged Combine benchmarks from Supabase, newest date first.
 *
 * Returns an empty array when no rows exist (typical pre-baseline state).
 * RLS allows anon SELECT on `movement_benchmarks`, so this works without
 * the user being signed in. Each row is parsed against
 * {@link BenchmarkSchema} after null values are dropped, so a DB-shape
 * drift fails fast at the data-layer boundary instead of producing a
 * confused render downstream.
 *
 * @throws when the Supabase query fails (network error, misconfigured
 *   env) or when a row fails Zod validation. Callers usually downgrade
 *   this to an empty render — see `CombineDataIsland`.
 */
export async function getMovementBenchmarks(): Promise<Benchmark[]> {
  const supabase = getBrowserSupabaseClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .order('date', { ascending: false })
  if (error) {
    throw new Error(`Failed to load movement benchmarks: ${error.message}`)
  }
  const stripped = (data ?? []).map(stripNulls)
  const parsed = BenchmarkRowsSchema.safeParse(stripped)
  if (!parsed.success) {
    throw new Error(
      `Movement benchmarks failed schema validation: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

/**
 * Postgres returns `null` for omitted optional columns, but the
 * `Benchmark` type and `BenchmarkSchema` declare fields as
 * `T | undefined` (via `?:` / `.optional()`). Map `null` → omitted so
 * downstream validation accepts the row the same way it accepts the
 * legacy JSON shape (which used absent keys, never `null`).
 */
function stripNulls(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) out[key] = value
  }
  return out
}

/**
 * Insert a new benchmark entry. Calls the admin-gated POST route, which
 * runs as the service role server-side.
 *
 * @param entry The full benchmark to log. `entry.date` is the primary key.
 * @throws Error containing the route's `{ error }` message verbatim on
 *   any non-2xx response — e.g. "Sign in required." (401),
 *   "Admin only." (403), "Benchmark for 2026-04-15 already exists.
 *   Use PUT to overwrite." (409). Falls back to a generic
 *   `Failed to log benchmark: <status> <statusText>` when the body has
 *   no JSON `error` field.
 */
export async function logBenchmark(entry: Benchmark): Promise<void> {
  const res = await fetch(WRITE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw await writeError(res, 'log')
}

/**
 * Update an existing benchmark identified by date.
 *
 * @param date    The benchmark's date — primary key, cannot be changed.
 * @param updates Partial set of fields to update; omitted fields stay as-is.
 * @throws Error containing the route's `{ error }` message verbatim on
 *   any non-2xx response — e.g. "Sign in required." (401),
 *   "Admin only." (403), "No benchmark for 2026-04-15." (404). Falls
 *   back to a generic message when the body has no JSON `error` field.
 */
export async function updateBenchmark(
  date: BenchmarkDate,
  updates: BenchmarkUpdate,
): Promise<void> {
  const res = await fetch(`${WRITE_ROUTE}/${encodeURIComponent(date)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw await writeError(res, 'update')
}

/**
 * Remove the benchmark for the given date. UI should confirm before calling.
 *
 * @param date The benchmark's date — primary key.
 * @throws Error containing the route's `{ error }` message verbatim on
 *   any non-2xx response — e.g. "Sign in required." (401),
 *   "Admin only." (403), "No benchmark for 2026-04-15." (404).
 */
export async function deleteBenchmark(date: BenchmarkDate): Promise<void> {
  const res = await fetch(`${WRITE_ROUTE}/${encodeURIComponent(date)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw await writeError(res, 'delete')
}

/**
 * Build a descriptive Error for a failed write. Surfaces the route's
 * own `{ error: "..." }` message verbatim when present so callers see
 * the exact domain reason (e.g. "Admin only.", "No benchmark for
 * 2026-04-15.") instead of a generic "Failed to update benchmark: 403".
 *
 * @param res    The non-OK fetch response.
 * @param action Verb describing what the caller was trying to do
 *   (`'log'`, `'update'`, `'delete'`). Used in the fallback message
 *   when the response body has no `error` field.
 */
async function writeError(res: Response, action: string): Promise<Error> {
  const detail = await res.text().catch(() => '')
  const apiMessage = parseErrorMessage(detail)
  if (apiMessage) return new Error(apiMessage)
  return new Error(
    `Failed to ${action} benchmark: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
  )
}

/**
 * Extract an `error` field from a JSON response body, returning `null`
 * when the body isn't valid JSON or the field is missing/non-string.
 */
function parseErrorMessage(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
    ) {
      return (parsed as { error: string }).error
    }
  } catch {
    // Not JSON — caller falls back to the generic non-OK message.
  }
  return null
}
