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
 * Fetch all logged Combine benchmarks from Supabase, newest date first.
 *
 * Returns an empty array when no rows exist (typical pre-baseline state).
 * RLS allows anon SELECT on `movement_benchmarks`, so this works without
 * the user being signed in.
 *
 * @throws when the Supabase query fails (network error, misconfigured
 *   env). Callers usually downgrade this to an empty render — see
 *   `CombineDataIsland`.
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
  return (data ?? []).map(rowToBenchmark)
}

/**
 * Postgres returns `null` for omitted optional columns, but the
 * `Benchmark` type declares fields as `T | undefined` (via `?:`). Map
 * `null` → omitted so downstream Zod re-validations and the
 * `entry.bodyweight_lbs?.toString()` patterns in the form behave the
 * same as the legacy JSON shape (which used absent keys, never `null`).
 */
function rowToBenchmark(row: Record<string, unknown>): Benchmark {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) out[key] = value
  }
  return out as unknown as Benchmark
}

/**
 * Insert a new benchmark entry. Calls the admin-gated POST route, which
 * runs as the service role server-side. Throws with the route's domain
 * message on any non-2xx so callers can surface it verbatim
 * (e.g. "Sign in required.", "Admin only.", "Benchmark for 2026-04-15
 * already exists. Use PUT to overwrite.").
 *
 * @param entry The full benchmark to log. `entry.date` is the primary key.
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
