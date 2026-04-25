import type {
  Benchmark,
  BenchmarkDate,
  BenchmarkUpdate,
} from '@/types/movement';
import { DATA_BASE_URL } from './config';

/** Dev-only API route that handles all benchmark writes (POST/PUT/DELETE). Built in #59. */
const WRITE_ROUTE = '/api/dev/movement-benchmarks';

/**
 * Fetches all logged Combine benchmarks (`public/data/movement_benchmarks.json`).
 *
 * Returns an empty array if the file doesn't exist yet (typical pre-baseline state).
 *
 * @throws on non-404 fetch failures.
 */
export async function getMovementBenchmarks(): Promise<Benchmark[]> {
  const res = await fetch(`${DATA_BASE_URL}/movement_benchmarks.json`);
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

/** Builds a descriptive Error for a failed write, distinguishing prod-404 from real failures. */
async function writeError(res: Response, action: string): Promise<Error> {
  if (res.status === 404) {
    return new Error(
      `Cannot ${action} benchmark: dev-only write API is unavailable in this environment.`,
    );
  }
  const detail = await res.text().catch(() => '');
  return new Error(
    `Failed to ${action} benchmark: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
  );
}
