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
