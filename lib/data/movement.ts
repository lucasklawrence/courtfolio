import type {
  Benchmark,
  BenchmarkDate,
  BenchmarkUpdate,
} from '@/types/movement';
import { DATA_BASE_URL } from './config';

/** Dev-only API route that handles all benchmark writes (POST/PUT/DELETE). Built in #59. */
const WRITE_ROUTE = '/api/dev/movement-benchmarks';

/** Optional knobs for {@link getMovementBenchmarks}. */
export interface GetMovementBenchmarksOptions {
  /**
   * Forwarded to `fetch` as `cache`. Defaults to the browser default (memory
   * + HTTP cache). Pass `'no-store'` after a write to bypass any cached copy
   * of the static JSON — the dev write API mutates the file in place, so a
   * cached response would otherwise mask the new entry until reload.
   */
  cache?: RequestCache;
}

/**
 * Fetches all logged Combine benchmarks (`public/data/movement_benchmarks.json`).
 *
 * Returns an empty array if the file doesn't exist yet (typical pre-baseline state).
 *
 * @param options - See {@link GetMovementBenchmarksOptions}.
 * @throws on non-404 fetch failures.
 */
export async function getMovementBenchmarks(
  options?: GetMovementBenchmarksOptions,
): Promise<Benchmark[]> {
  const res = await fetch(
    `${DATA_BASE_URL}/movement_benchmarks.json`,
    options?.cache ? { cache: options.cache } : undefined,
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(
      `Failed to load movement benchmarks: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
}

/**
 * Appends a new benchmark entry. Dev-only — the underlying API route returns
 * 404 in production, in which case this function throws a descriptive error.
 *
 * @param entry The full benchmark to log. `entry.date` is the primary key.
 */
export async function logBenchmark(entry: Benchmark): Promise<void> {
  const res = await fetch(WRITE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw await writeError(res, 'log');
}

/**
 * Overwrites an existing benchmark identified by date. Dev-only.
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
  });
  if (!res.ok) throw await writeError(res, 'update');
}

/**
 * Removes the benchmark for the given date. Dev-only. UI should confirm before calling.
 *
 * @param date The benchmark's date — primary key.
 */
export async function deleteBenchmark(date: BenchmarkDate): Promise<void> {
  const res = await fetch(`${WRITE_ROUTE}/${encodeURIComponent(date)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await writeError(res, 'delete');
}

/**
 * Builds a descriptive Error for a failed write.
 *
 * The route returns 404 in two cases that look identical from a status code alone:
 * 1. The dev-gate (route-level guard for `NODE_ENV !== 'development'`) — empty body.
 * 2. A missing benchmark (PUT/DELETE against a date that doesn't exist) — JSON body with an `error` field (e.g. `{ error: "No benchmark for 2026-04-15." }`).
 *
 * Disambiguating by body lets the form surface a "no entry for that date"
 * domain error without misreporting it as "dev API unavailable" while
 * developing locally.
 *
 * @param res    The non-OK fetch response.
 * @param action Verb describing what the caller was trying to do (`'log'`, `'update'`, `'delete'`). Used in the fallback message.
 */
async function writeError(res: Response, action: string): Promise<Error> {
  const detail = await res.text().catch(() => '');
  if (res.status === 404) {
    if (detail.trim() === '') {
      return new Error(
        `Cannot ${action} benchmark: dev-only write API is unavailable in this environment.`,
      );
    }
    const apiMessage = parseErrorMessage(detail);
    if (apiMessage) return new Error(apiMessage);
    // 404 with a non-JSON body (or JSON without an `error` field) —
    // fall through to the generic non-OK path below.
  }
  return new Error(
    `Failed to ${action} benchmark: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
  );
}

/**
 * Extracts an `error` field from a JSON response body, returning `null`
 * when the body isn't valid JSON or the field is missing / non-string.
 * Used by {@link writeError} to surface the route's domain message
 * verbatim (e.g. `"No benchmark for 2026-04-15."`).
 *
 * @param body Raw response text. Caller is responsible for the empty-body case.
 */
function parseErrorMessage(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // Not JSON — caller falls back to the generic non-OK message.
  }
  return null;
}
