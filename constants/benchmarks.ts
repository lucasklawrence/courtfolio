/**
 * Tier-1 Combine benchmark display config (PRD §7.7).
 *
 * Single source of truth for how each metric is named, formatted, and
 * scored. All visualizations (TradingCard, signature Combine viz, history
 * tables, future radar charts) read from {@link BENCHMARKS}. Adding or
 * modifying a metric is a config change here — never a chart rewrite.
 *
 * The keys mirror the snake_case fields on {@link Benchmark} (see
 * `types/movement.ts`), so a chart can iterate the config and use each
 * key directly to read entry values:
 * ```ts
 * for (const [key, spec] of Object.entries(BENCHMARKS)) {
 *   const value = entry[key as MetricKey];
 *   render(spec.shortLabel, value, spec.unit);
 * }
 * ```
 */

/**
 * Subset of {@link Benchmark} fields that are numeric metrics (not `date`,
 * `notes`, or `is_complete`). The four Tier-1 Combine measurements per
 * PRD §5.
 */
export type MetricKey = 'shuttle_5_10_5_s' | 'vertical_in' | 'sprint_10y_s' | 'bodyweight_lbs'

/**
 * Display + scoring config for one numeric benchmark metric. Mirrors the
 * shape sketched in PRD §7.7 with two added display fields (`shortLabel`,
 * `precision`) needed by the Trading Card and other compact surfaces.
 */
export interface BenchmarkConfig {
  /** Long display name — e.g. "5-10-5 Shuttle". Used in tooltips, axis labels, page headers. */
  label: string
  /** Short Panini-style label — e.g. "5-10-5", "VERT". Used in card stat blocks and dense tables. */
  shortLabel: string
  /** Suffix appended after the value when rendered — e.g. "s", "\"", " lbs". */
  unit: string
  /**
   * Which direction is "more athletic." `'lower'` for time/weight metrics
   * (a smaller shuttle time is faster); `'higher'` for vertical jump.
   * Drives PB detection and the orientation of any progress gauge.
   */
  direction: 'lower' | 'higher'
  /** Decimal places to render. Vertical/weight: 1; timed events: 2 (hundredths matter). */
  precision: number
  /**
   * Reasonable display range `[a, b]` where `a < b`. Direction-aware:
   * for `'lower'` metrics the elite end is `a`, for `'higher'` it's `b`.
   * Used by gauges, radar axes, and color mapping; never for clamping
   * raw entry values.
   */
  targetRange: readonly [number, number]
}

/**
 * The Tier-1 metrics, in canonical display order. Iterating
 * `Object.values(BENCHMARKS)` gives the order used on the Trading Card
 * front and the back-of-card history table; iterating
 * `Object.keys(BENCHMARKS)` gives the corresponding entry-field names
 * for {@link Benchmark}.
 */
export const BENCHMARKS: Readonly<Record<MetricKey, BenchmarkConfig>> = {
  vertical_in: {
    label: 'Vertical Jump',
    shortLabel: 'VERT',
    unit: '"',
    direction: 'higher',
    precision: 1,
    targetRange: [16, 32],
  },
  shuttle_5_10_5_s: {
    label: '5-10-5 Shuttle',
    shortLabel: '5-10-5',
    unit: 's',
    direction: 'lower',
    precision: 2,
    targetRange: [4.5, 6.0],
  },
  sprint_10y_s: {
    label: '10-Yard Sprint',
    shortLabel: '10Y',
    unit: 's',
    direction: 'lower',
    precision: 2,
    targetRange: [1.6, 2.2],
  },
  bodyweight_lbs: {
    label: 'Bodyweight',
    shortLabel: 'WT',
    unit: ' lbs',
    direction: 'lower',
    precision: 1,
    targetRange: [210, 240],
  },
} as const

/**
 * Ordered list of metric keys for callers that want to iterate without
 * relying on `Object.keys` insertion order. Same content as
 * `Object.keys(BENCHMARKS)` but typed as `MetricKey[]` and stable.
 */
export const METRIC_KEYS: readonly MetricKey[] = [
  'vertical_in',
  'shuttle_5_10_5_s',
  'sprint_10y_s',
  'bodyweight_lbs',
] as const

/**
 * Type guard narrowing an arbitrary string to a {@link MetricKey}. Useful
 * when reading config keys back out of `Object.keys` typed as `string[]`.
 *
 * Uses `Object.hasOwn` rather than `in` so inherited props (`toString`,
 * `__proto__`, etc.) don't slip through as false positives.
 */
export function isMetricKey(value: string): value is MetricKey {
  return Object.hasOwn(BENCHMARKS, value)
}
