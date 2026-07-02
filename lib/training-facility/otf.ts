import { isInRange, type DateRange } from '@/components/training-facility/shared/DateFilter'
import type { OtfSession, OtfZoneMinutes } from '@/types/otf'

/**
 * Pure derivations for the OrangeTheory Gym view (#256). Mirrors the
 * per-activity helper modules (`lib/training-facility/running.ts`,
 * `stair.ts`) — components stay rendering-only and import these for the
 * date-range filtering, zone aggregation, and headline stats.
 */

/** OTbeat HR-zone display order + colors (gray → red), as the email reports them. */
export const OTF_ZONES: ReadonlyArray<{
  /** Zone key matching {@link OtfZoneMinutes}. */
  key: keyof OtfZoneMinutes
  /** Short axis/label text. */
  shortLabel: string
  /** Display color (OTbeat's zone palette). */
  color: string
}> = [
  { key: 'gray', shortLabel: 'Gray', color: '#9ca3af' },
  { key: 'blue', shortLabel: 'Blue', color: '#3b82f6' },
  { key: 'green', shortLabel: 'Green', color: '#22c55e' },
  { key: 'orange', shortLabel: 'Orange', color: '#f97316' },
  { key: 'red', shortLabel: 'Red', color: '#dc2626' },
]

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
 * A trend rescaled to its own [0, 1] range so it can be overlaid with other
 * metrics of different units on one shared axis (the combined machine charts,
 * #266). `min`/`max` carry the original absolute range for the legend, since
 * normalization discards it.
 */
export interface OtfNormalizedTrend {
  /** Same dates as the input, with `value` remapped into [0, 1]. */
  points: OtfTrendPoint[]
  /** Smallest raw value in the input (0 when the input was empty). */
  min: number
  /** Largest raw value in the input (0 when the input was empty). */
  max: number
}

/**
 * Min–max normalize a trend to [0, 1] for the multi-metric overlay (#266).
 * A flat trend (every value equal, including a single point) maps to a
 * constant 0.5 so the line sits mid-axis rather than dividing by a zero span.
 * An empty trend yields no points and a `[0, 0]` range.
 */
export function normalizeOtfTrend(trend: readonly OtfTrendPoint[]): OtfNormalizedTrend {
  if (trend.length === 0) return { points: [], min: 0, max: 0 }
  let min = Infinity
  let max = -Infinity
  for (const p of trend) {
    if (p.value < min) min = p.value
    if (p.value > max) max = p.value
  }
  const span = max - min
  const points = trend.map(p => ({
    date: p.date,
    value: span === 0 ? 0.5 : (p.value - min) / span,
  }))
  return { points, min, max }
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
