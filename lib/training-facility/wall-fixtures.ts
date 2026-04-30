/**
 * Wall-fixture derivation helpers (PRD §7.4).
 *
 * Pure functions that project the {@link CardioData} payload into the
 * three values the in-scene Gym wall fixtures display: the latest
 * resting-HR reading + sparkline series, the latest VO2max reading +
 * trend series, and the rolling-7-day cardio totals (sessions, duration,
 * distance) shown on the wall scoreboard.
 *
 * Each helper returns `null` when there's no qualifying data so the
 * fixture render path can fall back to its painted placeholder values
 * instead of rendering an em-dash that makes the scene look broken on
 * first load.
 */

import type {
  CardioData,
  CardioSession,
  CardioTimePoint,
} from '@/types/cardio'

import { parseSessionDate } from './cardio-shared'

/**
 * Up to N most-recent points from a {@link CardioTimePoint} series, in
 * oldest-→-newest order so a chart can iterate them left-to-right
 * without resorting.
 *
 * Common helper for the resting-HR sparkline and the VO2max trend; both
 * surfaces want "the last N readings, time-ordered" but {@link CardioData}
 * makes no ordering guarantee on the source arrays.
 *
 * @param series - Trend series from `CardioData.resting_hr_trend` or `vo2max_trend`. May be undefined / empty.
 * @param limit - Maximum number of points to return. Caller picks the cap that matches the chart's coord box.
 */
export function takeLatestPoints(
  series: readonly CardioTimePoint[] | undefined,
  limit: number,
): CardioTimePoint[] {
  if (!series || series.length === 0 || limit <= 0) return []
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.slice(-limit)
}

/** What the HR-monitor wall fixture needs to render against live data. */
export interface RestingHrSnapshot {
  /** Latest resting-HR value in BPM, rounded to a whole number for the readout. */
  bpm: number
  /** Up to N most-recent points (oldest → newest) for the sparkline. */
  series: CardioTimePoint[]
}

/**
 * Build a {@link RestingHrSnapshot} from {@link CardioData}'s
 * `resting_hr_trend`. Returns `null` when the trend is missing or empty —
 * caller falls back to the painted placeholder so the wall doesn't read
 * as broken.
 *
 * @param data            Full cardio dataset, or `null` (file doesn't exist yet).
 * @param sparklineLimit  Maximum points to include in the sparkline series. Matches the existing fixture's 9-segment polyline.
 */
export function pickLatestRestingHr(
  data: CardioData | null,
  sparklineLimit: number,
): RestingHrSnapshot | null {
  if (!data) return null
  const series = takeLatestPoints(data.resting_hr_trend, sparklineLimit)
  if (series.length === 0) return null
  const latest = series[series.length - 1]
  return {
    bpm: Math.round(latest.value),
    series,
  }
}

/** What the VO2max-whiteboard wall fixture needs to render against live data. */
export interface Vo2MaxSnapshot {
  /** Latest VO2max value in ml/kg/min, rounded to one decimal for the readout. */
  value: number
  /** Up to N most-recent points (oldest → newest) for the trend chart. */
  series: CardioTimePoint[]
}

/**
 * Build a {@link Vo2MaxSnapshot} from {@link CardioData}'s `vo2max_trend`.
 * Returns `null` when the trend is missing or empty.
 *
 * @param data        Full cardio dataset, or `null`.
 * @param trendLimit  Maximum points to include in the trend series. Matches the existing whiteboard's 7-point polyline.
 */
export function pickLatestVo2max(
  data: CardioData | null,
  trendLimit: number,
): Vo2MaxSnapshot | null {
  if (!data) return null
  const series = takeLatestPoints(data.vo2max_trend, trendLimit)
  if (series.length === 0) return null
  const latest = series[series.length - 1]
  return {
    value: Math.round(latest.value * 10) / 10,
    series,
  }
}

/** What the wall scoreboard fixture renders for the rolling-7-day window. */
export interface WeeklyCardioTotals {
  /** Number of sessions in the window. */
  sessions: number
  /** Total duration formatted as `H:MM` (e.g. `4:12`). Zero seconds renders as `0:00`. */
  durationLabel: string
  /** Total distance in miles, formatted to one decimal (e.g. `11.6`). */
  milesLabel: string
}

const METERS_PER_MILE = 1609.344
const ROLLING_WINDOW_DAYS = 7

/**
 * Sum sessions, duration, and distance over the rolling N-day window
 * ending at `now`. Rolling rather than calendar-week so the totals
 * change smoothly as new sessions land — no Sunday-vs-Monday boundary
 * surprise the day after an Apple Health import.
 *
 * Sessions whose `date` field can't be parsed are dropped. Distance
 * defaults to zero for sessions missing `distance_meters` (stair
 * sessions usually omit it); the count and duration still reflect them.
 *
 * @param data - Full cardio dataset, or `null`.
 * @param now  - Reference "today" (defaults to `new Date()`). Tests pass a fixed date so the rolling window is deterministic.
 */
export function deriveWeeklyCardioTotals(
  data: CardioData | null,
  now: Date = new Date(),
): WeeklyCardioTotals | null {
  if (!data || !data.sessions || data.sessions.length === 0) return null
  const windowStartMs = now.getTime() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const nowMs = now.getTime()

  let sessions = 0
  let totalSeconds = 0
  let totalMeters = 0

  for (const s of data.sessions as readonly CardioSession[]) {
    const ts = parseSessionDate(s.date).getTime()
    if (!Number.isFinite(ts)) continue
    if (ts < windowStartMs || ts > nowMs) continue
    sessions += 1
    totalSeconds += Number.isFinite(s.duration_seconds) ? s.duration_seconds : 0
    if (typeof s.distance_meters === 'number' && Number.isFinite(s.distance_meters)) {
      totalMeters += s.distance_meters
    }
  }

  if (sessions === 0) return null

  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const durationLabel = `${hours}:${minutes.toString().padStart(2, '0')}`
  const miles = totalMeters / METERS_PER_MILE
  const milesLabel = miles.toFixed(1)

  return { sessions, durationLabel, milesLabel }
}
