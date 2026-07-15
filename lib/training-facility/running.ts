/**
 * Treadmill / running detail-view helpers (PRD §7.4).
 *
 * Pure functions for the pace-based charts: pace trend (min/mi over time),
 * cardiac efficiency (m/heartbeat over time), and pace-at-HR scatter. Only
 * {@link filterRunningSessions} is running-specific; the projection helpers
 * (`paceTrendPoints`, `cardiacEfficiencyPoints`, `paceAtHrPoints`,
 * `formatPacePerMile`, `formatPaceCellFromSecPerKm`, `formatDistanceMiles`)
 * are activity-agnostic and are imported as-is by `TrackDetailView` for the
 * walking modality. Activity-agnostic *time-in-zone* helpers live in
 * {@link ./cardio-shared}.
 */

import type { CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import { filterCardioSessionsByActivity, parseSessionDate } from './cardio-shared'

/** One mile in meters — used for pace and distance conversions. */
export const METERS_PER_MILE = 1609.344

/**
 * Fastest pace we treat as real, in sec/mi (2:30/mi). Faster than any
 * human-sustainable treadmill/track pace, so anything below is a bad import.
 */
const MIN_PLAUSIBLE_PACE_SEC_PER_MILE = 150

/**
 * Slowest pace we treat as real, in sec/mi (40:00/mi). Covers slow walking on
 * the track view (which reuses these helpers) while rejecting the paused /
 * zero-distance artifacts that surface as absurd `1000:00 /mi` outliers and
 * flatten the whole y-domain.
 */
const MAX_PLAUSIBLE_PACE_SEC_PER_MILE = 2400

/**
 * Largest cardiac-efficiency value we treat as real, in m/heartbeat. Normal
 * running is ~0.5–2.5 m/beat; a value above this needs implausibly fast travel
 * per beat and comes from a session with a bad HR reading, not real fitness.
 */
const MAX_PLAUSIBLE_METERS_PER_HEARTBEAT = 10

/** True when a converted pace (sec/mi) falls in the human-plausible band. */
function isPlausiblePaceSecPerMile(secPerMile: number): boolean {
  return (
    secPerMile >= MIN_PLAUSIBLE_PACE_SEC_PER_MILE &&
    secPerMile <= MAX_PLAUSIBLE_PACE_SEC_PER_MILE
  )
}

/**
 * Convert a pace from `sec/km` (the format `cardio.json` stores) to `sec/mi`
 * (the format the UI renders). Exported so the data helpers and the table-row
 * formatter share the conversion without duplicating the constant.
 *
 * @param secPerKm - Pace in seconds per kilometer (lower = faster).
 */
export function secPerKmToSecPerMile(secPerKm: number): number {
  return (secPerKm * METERS_PER_MILE) / 1000
}

/**
 * Filter `sessions` down to running entries inside `range`. Thin wrapper over
 * {@link filterCardioSessionsByActivity} so the `TreadmillDetailView` call
 * site reads as the equipment-specific verb.
 *
 * @param sessions - Full session list from `getCardioData()`.
 * @param range - Active range from the shared `DateFilter`.
 */
export function filterRunningSessions(
  sessions: readonly CardioSession[],
  range: DateRange,
): CardioSession[] {
  return filterCardioSessionsByActivity(sessions, 'running', range)
}

/** One point on the pace-trend line chart. */
export interface PaceTrendPoint {
  /** Local-midnight `Date` for the session — used as the x-scale value. */
  date: Date
  /** Original session date string, kept for keying and table joins. */
  rawDate: string
  /** Pace in seconds per mile (lower = faster). Y value of the chart. */
  paceSecondsPerMile: number
}

/**
 * Project running sessions to pace-trend points (seconds per mile).
 *
 * Source data is `pace_seconds_per_km`; conversion is `× 1609.344 / 1000`.
 * Sessions without a numeric pace, with non-positive pace (sentinel for
 * "missing" in some Apple Health exports), with a converted pace outside the
 * human-plausible band (see {@link isPlausiblePaceSecPerMile}), or with an
 * unparseable date are dropped — the chart renders gaps as missing points
 * rather than outliers that would compress the y-domain.
 *
 * @param sessions - Filtered, sorted running sessions.
 */
export function paceTrendPoints(sessions: readonly CardioSession[]): PaceTrendPoint[] {
  const out: PaceTrendPoint[] = []
  for (const s of sessions) {
    const secPerKm = s.pace_seconds_per_km
    if (typeof secPerKm !== 'number' || !Number.isFinite(secPerKm) || secPerKm <= 0) continue
    const paceSecondsPerMile = secPerKmToSecPerMile(secPerKm)
    if (!isPlausiblePaceSecPerMile(paceSecondsPerMile)) continue
    const date = parseSessionDate(s.date)
    if (!Number.isFinite(date.getTime())) continue
    out.push({ date, rawDate: s.date, paceSecondsPerMile })
  }
  return out
}

/** One point on the cardiac-efficiency line chart. */
export interface CardiacEfficiencyPoint {
  /** Local-midnight `Date` for the session. */
  date: Date
  /** Original session date string. */
  rawDate: string
  /** Distance covered per heartbeat, in meters. Higher = more efficient. */
  metersPerHeartbeat: number
}

/**
 * Project running sessions to cardiac-efficiency points (m/heartbeat over
 * time). Sessions missing `meters_per_heartbeat`, with non-positive values,
 * with an implausibly high value (see {@link MAX_PLAUSIBLE_METERS_PER_HEARTBEAT}
 * — a bad-HR artifact that spikes the y-domain), or with an unparseable date
 * are dropped.
 *
 * @param sessions - Filtered, sorted running sessions.
 */
export function cardiacEfficiencyPoints(
  sessions: readonly CardioSession[],
): CardiacEfficiencyPoint[] {
  const out: CardiacEfficiencyPoint[] = []
  for (const s of sessions) {
    const mph = s.meters_per_heartbeat
    if (typeof mph !== 'number' || !Number.isFinite(mph) || mph <= 0) continue
    if (mph > MAX_PLAUSIBLE_METERS_PER_HEARTBEAT) continue
    const date = parseSessionDate(s.date)
    if (!Number.isFinite(date.getTime())) continue
    out.push({ date, rawDate: s.date, metersPerHeartbeat: mph })
  }
  return out
}

/** One point on the pace-at-HR scatter plot. */
export interface PaceAtHrPoint {
  /** Original session date string — used as a stable key. */
  rawDate: string
  /** Average heart rate over the session, BPM. X value of the scatter. */
  avgHr: number
  /** Pace in seconds per mile. Y value of the scatter (lower = faster). */
  paceSecondsPerMile: number
}

/**
 * Project running sessions to scatter-plot points (avg HR vs pace). Both
 * fields must be present and positive, and the converted pace must fall in the
 * human-plausible band (see {@link isPlausiblePaceSecPerMile}) — there's no
 * defensible value to plot for a session missing either coordinate or carrying
 * an artifact pace. The lower-left quadrant is "fast at low effort" (most
 * efficient).
 *
 * @param sessions - Filtered, sorted running sessions.
 */
export function paceAtHrPoints(sessions: readonly CardioSession[]): PaceAtHrPoint[] {
  const out: PaceAtHrPoint[] = []
  for (const s of sessions) {
    if (typeof s.avg_hr !== 'number' || !Number.isFinite(s.avg_hr) || s.avg_hr <= 0) continue
    const secPerKm = s.pace_seconds_per_km
    if (typeof secPerKm !== 'number' || !Number.isFinite(secPerKm) || secPerKm <= 0) continue
    const paceSecondsPerMile = secPerKmToSecPerMile(secPerKm)
    if (!isPlausiblePaceSecPerMile(paceSecondsPerMile)) continue
    out.push({ rawDate: s.date, avgHr: s.avg_hr, paceSecondsPerMile })
  }
  return out
}

/**
 * Format a pace in seconds-per-mile as `M:SS` or `M:SS /mi`.
 *
 * Used by tick labels on pace charts (`includeUnit: false`) and the session
 * log Pace column (`includeUnit: true`). Returns `—` for non-finite or
 * non-positive input so a malformed point doesn't render as `NaN:NaN`.
 *
 * @param secondsPerMile - Pace value (lower = faster).
 * @param includeUnit - When `true`, append ` /mi`. Defaults to `true`.
 */
export function formatPacePerMile(secondsPerMile: number, includeUnit = true): string {
  if (!Number.isFinite(secondsPerMile) || secondsPerMile <= 0) return '—'
  const total = Math.round(secondsPerMile)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  const base = `${mins}:${secs.toString().padStart(2, '0')}`
  return includeUnit ? `${base} /mi` : base
}

/**
 * Format a `pace_seconds_per_km` value (the on-disk format) directly as a
 * display string. Convenience wrapper for the session-log Pace column — saves
 * call sites from threading the conversion + formatting through two helpers.
 *
 * @param paceSecondsPerKm - Raw `CardioSession.pace_seconds_per_km`. Missing /
 *   non-positive / non-finite inputs render as `—`.
 */
export function formatPaceCellFromSecPerKm(paceSecondsPerKm: number | undefined): string {
  if (
    typeof paceSecondsPerKm !== 'number' ||
    !Number.isFinite(paceSecondsPerKm) ||
    paceSecondsPerKm <= 0
  ) {
    return '—'
  }
  return formatPacePerMile(secPerKmToSecPerMile(paceSecondsPerKm))
}

/**
 * Format a distance in meters as a miles string with one decimal (e.g.
 * `3.1 mi`). Returns `—` for non-finite, negative, or zero input — the column
 * shows missing distance as a dash rather than `0.0 mi`.
 *
 * @param meters - Raw distance from `CardioSession.distance_meters`.
 */
export function formatDistanceMiles(meters: number | undefined): string {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) return '—'
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`
}
