/**
 * Movement benchmark schema (PRD §7.6, §7.11).
 *
 * Single source of truth for the shape of `public/data/movement_benchmarks.json`,
 * the dev-only write API route, and any future hosted API. Keep field names in
 * snake_case to match the on-disk JSON.
 */

export type BenchmarkDate = string;

export interface Benchmark {
  date: BenchmarkDate;
  bodyweight_lbs?: number;
  shuttle_5_10_5_s?: number;
  vertical_in?: number;
  sprint_10y_s?: number;
  notes?: string;
  is_complete?: boolean;
}

export type BenchmarkUpdate = Partial<Omit<Benchmark, 'date'>>;
