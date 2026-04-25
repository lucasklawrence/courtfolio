/**
 * Movement benchmark schema (PRD §7.6, §7.11).
 *
 * Single source of truth for the shape of `public/data/movement_benchmarks.json`,
 * the dev-only write API route, and any future hosted API. Keep field names in
 * snake_case to match the on-disk JSON.
 */

/** ISO calendar date in `YYYY-MM-DD` form. Identifies a benchmark session. */
export type BenchmarkDate = string;

/**
 * One monthly Combine benchmark entry. All metric fields are optional —
 * partial entries (e.g. a bodyweight-only week) are valid per PRD §7.6.
 */
export interface Benchmark {
  /** Session date — primary key. One entry per date. */
  date: BenchmarkDate;
  /** Morning bodyweight in pounds, ideally a 3-day weekly average (PRD §5). */
  bodyweight_lbs?: number;
  /** Best-of-3 5-10-5 pro-agility shuttle time in seconds. Lower is better. */
  shuttle_5_10_5_s?: number;
  /** Best-of-3 standing vertical jump in inches (jump-touch minus standing reach). */
  vertical_in?: number;
  /** Best-of-3 10-yard sprint time in seconds from a 2-point stance. Lower is better. */
  sprint_10y_s?: number;
  /** Free-text session notes — conditions, RPE, anything qualitative. */
  notes?: string;
  /**
   * Set `false` to mark a session as test/incomplete (PRD §7.11). Excluded
   * from trend calculations and visualizations but kept in the history table.
   * Defaults to complete when omitted.
   */
  is_complete?: boolean;
}

/** Partial benchmark payload for in-place edits. The date is the identifier and cannot be changed. */
export type BenchmarkUpdate = Partial<Omit<Benchmark, 'date'>>;
