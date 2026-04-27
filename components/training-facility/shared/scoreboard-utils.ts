import type { Benchmark } from '@/types/movement'
import { BENCHMARKS, type MetricKey } from '@/constants/benchmarks'

/**
 * Display order for the Combine scoreboard cells per PRD §9.1:
 * Bodyweight → 5-10-5 → Vertical → 10y Sprint. Differs from the canonical
 * `METRIC_KEYS` order (which leads with vertical) because the scoreboard
 * reads left-to-right starting with body context.
 */
export const SCOREBOARD_METRIC_ORDER: readonly MetricKey[] = [
  'bodyweight_lbs',
  'shuttle_5_10_5_s',
  'vertical_in',
  'sprint_10y_s',
] as const

/**
 * One cell of the scoreboard. The parent supplies already-derived numbers
 * and metric metadata so the component stays purely a display surface
 * (the same shape will drive the future Gym wall scoreboard, where the
 * "metrics" are session totals, not Combine benchmarks).
 */
export interface ScoreboardCell {
  /** Header label rendered above the digits — short form (e.g. "VERT", "5-10-5"). */
  label: string
  /** Latest value, or `undefined` when no qualifying entry exists. */
  value?: number
  /** Baseline value used to derive the delta. `undefined` skips delta rendering. */
  baseline?: number
  /** Which direction means "improvement" — drives delta color. */
  direction: 'lower' | 'higher'
  /** Decimals to render. Time metrics use 2; vertical/weight use 1. */
  precision: number
  /** Unit suffix appended after the value (e.g. "s", "\"", " lbs"). */
  unit: string
}

/**
 * Pick the most recent value for a single metric across a benchmark
 * history. Skips entries that explicitly set `is_complete: false`
 * (test/incomplete sessions per PRD §7.11) and entries with no value for
 * the metric (partial entries are valid per `Benchmark` type docs).
 *
 * Returns `undefined` when no qualifying entry exists.
 *
 * @param entries Benchmark history. Order does not matter; the function compares dates.
 * @param key     Which metric to inspect.
 */
export function pickMetricLatest(
  entries: readonly Benchmark[],
  key: MetricKey,
): number | undefined {
  let best: { date: string; value: number } | undefined
  for (const entry of entries) {
    if (entry.is_complete === false) continue
    const value = entry[key]
    if (typeof value !== 'number') continue
    if (!best || entry.date > best.date) best = { date: entry.date, value }
  }
  return best?.value
}

/**
 * Pick the earliest value for a single metric — the per-metric baseline.
 *
 * Per-metric (rather than per-entry) baselining matters because partial
 * entries are valid: a January bodyweight-only week is a legitimate
 * bodyweight baseline even when it lacks a vertical. Same skip rules as
 * {@link pickMetricLatest}.
 *
 * @param entries Benchmark history. Order does not matter.
 * @param key     Which metric to inspect.
 */
export function pickMetricBaseline(
  entries: readonly Benchmark[],
  key: MetricKey,
): number | undefined {
  let best: { date: string; value: number } | undefined
  for (const entry of entries) {
    if (entry.is_complete === false) continue
    const value = entry[key]
    if (typeof value !== 'number') continue
    if (!best || entry.date < best.date) best = { date: entry.date, value }
  }
  return best?.value
}

/**
 * Improvement state of a delta given the metric's direction. `'neutral'`
 * means the values are identical (no color change); `null` means the
 * delta can't be computed (one side missing).
 */
export type DeltaStatus = 'improvement' | 'regression' | 'neutral'

/**
 * Classify `latest` vs `baseline` according to whether lower or higher is
 * better for this metric. Use the result to color-code the delta line.
 *
 * @param latest    Most recent value for the metric.
 * @param baseline  Reference value to compare against (typically the earliest entry's value).
 * @param direction Which direction is "improvement" — `'lower'` for time/weight metrics, `'higher'` for vertical jump.
 */
export function classifyDelta(
  latest: number | undefined,
  baseline: number | undefined,
  direction: 'lower' | 'higher',
): DeltaStatus | null {
  if (latest === undefined || baseline === undefined) return null
  if (latest === baseline) return 'neutral'
  const beats = direction === 'lower' ? latest < baseline : latest > baseline
  return beats ? 'improvement' : 'regression'
}

/**
 * Build the four-cell Combine scoreboard model from a benchmark history.
 *
 * Pure function — adding a metric to the scoreboard is a config change in
 * `constants/benchmarks.ts` plus an entry in {@link SCOREBOARD_METRIC_ORDER}.
 * Iterates the order constant rather than `Object.keys(BENCHMARKS)` so
 * the on-screen sequence stays stable.
 *
 * @param entries Benchmark history. Order does not matter; the helpers compare dates.
 */
export function deriveCombineScoreboardCells(
  entries: readonly Benchmark[],
): ScoreboardCell[] {
  return SCOREBOARD_METRIC_ORDER.map((key) => {
    const spec = BENCHMARKS[key]
    return {
      label: spec.shortLabel,
      value: pickMetricLatest(entries, key),
      baseline: pickMetricBaseline(entries, key),
      direction: spec.direction,
      precision: spec.precision,
      unit: spec.unit,
    }
  })
}
