import type {
  Benchmark,
  BenchmarkDate,
  BenchmarkUpdate,
} from '@/types/movement';
import { DATA_BASE_URL } from './config';

const WRITE_ROUTE = '/api/dev/movement-benchmarks';

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

export async function logBenchmark(entry: Benchmark): Promise<void> {
  const res = await fetch(WRITE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw await writeError(res, 'log');
}

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

export async function deleteBenchmark(date: BenchmarkDate): Promise<void> {
  const res = await fetch(`${WRITE_ROUTE}/${encodeURIComponent(date)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await writeError(res, 'delete');
}

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
