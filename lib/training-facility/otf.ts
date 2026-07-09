import { isInRange, type DateRange } from '@/components/training-facility/shared/DateFilter'
import type { OtfSession, OtfZoneMinutes } from '@/types/otf'

/**
 * Pure derivations for the OrangeTheory Gym view (#256). Mirrors the
 * per-activity helper modules (`lib/training-facility/running.ts`,
 * `stair.ts`) — components stay rendering-only and import these for the
 * date-range filtering, zone aggregation, and headline stats.
 */

/** One OTbeat HR zone: display config plus its %-of-maxHR band boundaries. */
export interface OtfZoneConfig {
  /** Zone key matching {@link OtfZoneMinutes}. */
  key: keyof OtfZoneMinutes
  /** Short axis/label text (OTbeat names its zones by color). */
  shortLabel: string
  /** Long display name — OTbeat's effort description for the zone. */
  label: string
  /** Display color (OTbeat's zone palette). */
  color: string
  /**
   * Lower band bound as a fraction of max HR, inclusive. As OTbeat publishes
   * them (#261) — uneven bands, unlike the Apple model's even 10% steps.
   */
  minPct: number
  /**
   * Upper band bound as a fraction of max HR, inclusive. OTbeat publishes
   * integer percentages with 1%-point gaps between zones (e.g. gray ends at
   * 60%, blue starts at 61%), so this is not exactly the next zone's `minPct`.
   */
  maxPct: number
}

/**
 * OTbeat HR-zone display order + colors (gray → red) and %-of-maxHR bands, as
 * the OrangeTheory app reports them. Bands are uneven (green is a wide
 * 71–83%, orange a narrow 84–91%) and are off OTF's *own* maxHR estimate —
 * see {@link bpmRangeForOtfZone} to resolve them to bpm for a chosen maxHR.
 */
export const OTF_ZONES: readonly OtfZoneConfig[] = [
  { key: 'gray', shortLabel: 'Gray', label: 'Very light', color: '#9ca3af', minPct: 0.5, maxPct: 0.6 },
  { key: 'blue', shortLabel: 'Blue', label: 'Light', color: '#3b82f6', minPct: 0.61, maxPct: 0.7 },
  { key: 'green', shortLabel: 'Green', label: 'Base', color: '#22c55e', minPct: 0.71, maxPct: 0.83 },
  { key: 'orange', shortLabel: 'Orange', label: 'Challenging', color: '#f97316', minPct: 0.84, maxPct: 0.91 },
  { key: 'red', shortLabel: 'Red', label: 'All out', color: '#dc2626', minPct: 0.92, maxPct: 1.0 },
]

/**
 * Resolve an OTF zone's literal BPM range for a given max HR — the OTbeat
 * counterpart to `bpmRangeForZone` (Apple) in `constants/hr-zones.ts`. Used
 * by the zone-comparison view to label each band with concrete BPM values.
 *
 * @returns `[minBpm, maxBpm]` rounded to whole BPM.
 */
export function bpmRangeForOtfZone(zone: OtfZoneConfig, maxHr: number): [number, number] {
  return [Math.round(zone.minPct * maxHr), Math.round(zone.maxPct * maxHr)]
}

/** One zone's display config plus its aggregated minutes, for {@link OTF_ZONES}-ordered bar charts. */
export interface OtfZoneBucket {
  /** Zone key matching {@link OtfZoneMinutes}. */
  key: keyof OtfZoneMinutes
  /** Short axis label. */
  shortLabel: string
  /** Total minutes in this zone across the aggregated sessions. */
  minutes: number
  /** Display color. */
  color: string
}

/** A single `{date, value}` point for the OTF trend lines (splat, calories, HR). */
export interface OtfTrendPoint {
  /** Class start date. */
  date: Date
  /** Metric value at that class. */
  value: number
}

/** Parse a session's ISO `started_at` to a `Date`. */
export function otfSessionDate(session: OtfSession): Date {
  return new Date(session.started_at)
}

/**
 * Drop sessions flagged `excluded` — invalid/anomalous classes (e.g. an
 * equipment malfunction, #268) that must stay out of every aggregate, trend,
 * and highlight while the session log still lists them, muted. Preserves order.
 *
 * Apply this to the range-filtered sessions before any aggregation; keep the
 * unfiltered set for the log so the excluded rows remain visible.
 */
export function excludeInvalidOtfSessions(sessions: readonly OtfSession[]): OtfSession[] {
  return sessions.filter(s => !s.excluded)
}

/**
 * Canonical display order for the coarse auto-inferred class-type labels (#271).
 *
 * KEEP IN SYNC WITH the label constants in
 * `scripts/lib/otbeat-class-type.mjs` (guarded by a drift test in
 * `otf.test.ts`). Manual `class_type_override` values that aren't in this list
 * (e.g. "2G", "Strength 50") sort after these, alphabetically, in
 * {@link otfClassTypes}.
 */
export const OTF_CLASS_TYPE_ORDER: readonly string[] = [
  'Tread + Row',
  'Tread-focused',
  'Row-focused',
  'Strength / Floor',
]

/**
 * The class type the view should treat a session as: the manual
 * `class_type_override` when set, otherwise the auto-inferred `class_type`
 * (#271). Blank/whitespace strings count as unset. `undefined` when the session
 * has neither (e.g. a near-zero malfunction with no inferred type).
 */
export function effectiveOtfClassType(session: OtfSession): string | undefined {
  const override = session.class_type_override?.trim()
  if (override) return override
  const auto = session.class_type?.trim()
  return auto ? auto : undefined
}

/**
 * Distinct effective class types present across the sessions, for the filter
 * control's options. Known auto labels come first in {@link OTF_CLASS_TYPE_ORDER}
 * order; any manual-override values not in that list follow, sorted
 * alphabetically for a stable, session-order-independent result. Sessions with
 * no effective type are omitted.
 */
export function otfClassTypes(sessions: readonly OtfSession[]): string[] {
  const present = new Set<string>()
  for (const s of sessions) {
    const t = effectiveOtfClassType(s)
    if (t) present.add(t)
  }
  const known = OTF_CLASS_TYPE_ORDER.filter(t => present.has(t))
  const extras = [...present].filter(t => !OTF_CLASS_TYPE_ORDER.includes(t)).sort()
  return [...known, ...extras]
}

/**
 * Filter sessions to those whose {@link effectiveOtfClassType} equals
 * `classType`, preserving order. A `null` `classType` is the "All" sentinel and
 * returns every session (a fresh array). Composes with
 * {@link filterOtfSessionsInRange} and {@link excludeInvalidOtfSessions}.
 */
export function filterOtfSessionsByClassType(
  sessions: readonly OtfSession[],
  classType: string | null
): OtfSession[] {
  if (!classType) return [...sessions]
  return sessions.filter(s => effectiveOtfClassType(s) === classType)
}

/** Resolved state of the class-type filter for one render. */
export interface OtfClassTypeFilterState {
  /**
   * The class type actually applied this render: the user's `selected` value
   * when it's still among the `available` options, else `null` ("All"). Derived
   * synchronously so filtering never lags behind a window change by a render.
   */
  effective: string | null
  /**
   * Whether the filter control should render — either there's a real choice
   * (2+ options) or a filter is active and needs a reachable "All" to clear it.
   */
  visible: boolean
}

/**
 * Reconcile the class-type filter's stored `selected` value against the types
 * currently `available` in the window (#271).
 *
 * Two failure modes this closes:
 * - **Stale render:** when `selected` just left `available`, `effective` falls
 *   back to `null` immediately, so the log/aggregates don't render empty for a
 *   frame while a reset effect catches up.
 * - **Unclearable filter:** when the window narrows to a single type that's the
 *   active selection, `visible` stays `true` so the "All" button is still there
 *   to clear it (otherwise untyped/excluded rows would be hidden with no way
 *   back).
 */
export function resolveOtfClassTypeFilter(
  selected: string | null,
  available: readonly string[]
): OtfClassTypeFilterState {
  const effective = selected && available.includes(selected) ? selected : null
  return { effective, visible: available.length > 1 || effective !== null }
}

/**
 * Filter sessions to those whose start falls within the inclusive
 * {@link DateRange}, preserving order (the dataset arrives ascending).
 */
export function filterOtfSessionsInRange(
  sessions: readonly OtfSession[],
  range: DateRange
): OtfSession[] {
  return sessions.filter(s => {
    const d = otfSessionDate(s)
    return Number.isFinite(d.getTime()) && isInRange(d, range)
  })
}

/**
 * Sum each HR zone's minutes across the sessions into {@link OtfZoneBucket}s
 * in canonical {@link OTF_ZONES} order. Sessions without a zone block
 * contribute zero.
 */
export function aggregateOtfZoneMinutes(sessions: readonly OtfSession[]): OtfZoneBucket[] {
  return OTF_ZONES.map(z => ({
    key: z.key,
    shortLabel: z.shortLabel,
    color: z.color,
    minutes: sessions.reduce((acc, s) => acc + (s.zones_min?.[z.key] ?? 0), 0),
  }))
}

/**
 * Build a `{date, value}` trend from each session's value for `metric`,
 * dropping sessions where the metric is absent so the line isn't pinned to
 * zero on missing data.
 */
export function otfMetricTrend(
  sessions: readonly OtfSession[],
  metric: 'splat' | 'calories' | 'avg_hr'
): OtfTrendPoint[] {
  const points: OtfTrendPoint[] = []
  for (const s of sessions) {
    const value = s[metric]
    if (typeof value !== 'number') continue
    const date = otfSessionDate(s)
    if (Number.isFinite(date.getTime())) points.push({ date, value })
  }
  return points
}

/**
 * Parse an "MM:SS" duration (how OTbeat reports paces / splits / times) into
 * whole seconds for a numeric axis. Returns `null` on empty or malformed input.
 */
export function mmssToSeconds(value: string | null | undefined): number | null {
  if (!value || !value.includes(':')) return null
  const [mm, ss] = value.split(':')
  const minutes = Number(mm)
  const seconds = Number(ss)
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return minutes * 60 + seconds
}

/** Format whole seconds back to "M:SS" — for pace / split axis ticks. */
export function formatMmss(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Build a `{date, value}` trend from a numeric field inside each session's
 * `treadmill` or `rower` JSONB block. Sessions whose block is absent, or whose
 * picked value isn't a finite number, are dropped so the line isn't pinned to
 * zero on class formats that omit that machine.
 *
 * @param block Which performance block to read.
 * @param pick Extracts the metric from the block, e.g. `t => t.distance_mi` or
 *   `r => mmssToSeconds(r.split_500m)` for a "MM:SS" split.
 */
export function otfBlockTrend<K extends 'treadmill' | 'rower'>(
  sessions: readonly OtfSession[],
  block: K,
  pick: (b: NonNullable<OtfSession[K]>) => number | null | undefined
): OtfTrendPoint[] {
  const points: OtfTrendPoint[] = []
  for (const s of sessions) {
    const b = s[block] as NonNullable<OtfSession[K]> | undefined
    if (!b) continue
    const value = pick(b)
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const date = otfSessionDate(s)
    if (Number.isFinite(date.getTime())) points.push({ date, value })
  }
  return points
}

/**
 * The first and latest values of a trend, for the sparkline summary's
 * `first → latest` labels (#266). `null` when the trend is empty.
 */
export interface OtfTrendEndpoints {
  /** Value at the earliest point in the trend. */
  first: number
  /** Value at the latest point in the trend. */
  last: number
}

/**
 * First and last value of a `{date, value}` trend (assumed ascending, as the
 * dataset arrives). Returns `null` for an empty trend so callers render a
 * "no data" label instead of a range.
 */
export function otfTrendEndpoints(trend: readonly OtfTrendPoint[]): OtfTrendEndpoints | null {
  if (trend.length === 0) return null
  return { first: trend[0].value, last: trend[trend.length - 1].value }
}

/**
 * A least-squares trend line fitted over a `{date, value}` trend, expressed as
 * the two endpoints to draw plus the daily slope for a direction read-out.
 */
export interface OtfTrendLine {
  /**
   * Two points on the fitted line — at the earliest and latest dates in the
   * trend — so a chart can draw the regression as a single straight segment
   * spanning the same x-domain as the data.
   */
  points: OtfTrendPoint[]
  /**
   * Change in the fitted value per calendar day. Positive means the metric is
   * rising over time; the caller decides whether up is good (watts, distance)
   * or bad (pace, split).
   */
  slopePerDay: number
}

/** Milliseconds in a day — converts the ms-based regression slope to per-day. */
const MS_PER_DAY = 86_400_000

/**
 * Fit a least-squares regression line to a `{date, value}` trend, using each
 * point's epoch-milliseconds as x. Returns the line's endpoints (at the min and
 * max date, so it spans the data's x-domain) and its per-day slope.
 *
 * Returns `null` when the line is undefined: fewer than two points, or every
 * point sharing the same date (zero x-variance — a vertical line has no slope).
 */
export function otfLinearRegression(trend: readonly OtfTrendPoint[]): OtfTrendLine | null {
  if (trend.length < 2) return null
  const n = trend.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  let minX = Infinity
  let maxX = -Infinity
  for (const p of trend) {
    const x = p.date.getTime()
    const y = p.value
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slopePerMs = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slopePerMs * sumX) / n
  return {
    points: [
      { date: new Date(minX), value: slopePerMs * minX + intercept },
      { date: new Date(maxX), value: slopePerMs * maxX + intercept },
    ],
    slopePerDay: slopePerMs * MS_PER_DAY,
  }
}

/**
 * Trailing moving average of a `{date, value}` trend. Each output point keeps
 * its original date and replaces the value with the mean of up to `window`
 * values ending at that point (min-periods 1, so the output is the same length
 * as the input and the leading points average whatever is available so far).
 *
 * @param window Number of trailing points to average; values below 1 are
 *   treated as 1, yielding the original trend.
 */
export function otfRollingAverage(
  trend: readonly OtfTrendPoint[],
  window: number
): OtfTrendPoint[] {
  const size = Math.max(1, Math.floor(window))
  const out: OtfTrendPoint[] = []
  for (let i = 0; i < trend.length; i++) {
    const start = Math.max(0, i - size + 1)
    let sum = 0
    for (let j = start; j <= i; j++) sum += trend[j].value
    out.push({ date: trend[i].date, value: sum / (i - start + 1) })
  }
  return out
}

/** Headline stats for the OTF highlights strip, computed over a session set. */
export interface OtfHighlights {
  /** Number of classes. */
  classes: number
  /** Sum of splat points. */
  totalSplat: number
  /** Sum of calories. */
  totalCalories: number
  /** Mean splat points per class (0 when no classes). */
  avgSplat: number
  /** Highest splat points in a single class. */
  bestSplat: number
  /** Highest calories in a single class. */
  bestCalories: number
}

/** Compute {@link OtfHighlights} over the given sessions. */
export function otfHighlights(sessions: readonly OtfSession[]): OtfHighlights {
  let totalSplat = 0
  let totalCalories = 0
  let bestSplat = 0
  let bestCalories = 0
  for (const s of sessions) {
    const splat = s.splat ?? 0
    const calories = s.calories ?? 0
    totalSplat += splat
    totalCalories += calories
    if (splat > bestSplat) bestSplat = splat
    if (calories > bestCalories) bestCalories = calories
  }
  const classes = sessions.length
  return {
    classes,
    totalSplat,
    totalCalories,
    avgSplat: classes ? totalSplat / classes : 0,
    bestSplat,
    bestCalories,
  }
}

/** Format a session's start as `YYYY-MM-DD` (local). */
export function formatOtfDate(session: OtfSession): string {
  const d = otfSessionDate(session)
  if (!Number.isFinite(d.getTime())) return session.started_at
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** Earliest session start, or `null` when there are no sessions. Drives the `All` date-filter bound. */
export function earliestOtfDate(sessions: readonly OtfSession[]): Date | null {
  let earliest = Infinity
  for (const s of sessions) {
    const ms = otfSessionDate(s).getTime()
    if (Number.isFinite(ms) && ms < earliest) earliest = ms
  }
  return Number.isFinite(earliest) ? new Date(earliest) : null
}
