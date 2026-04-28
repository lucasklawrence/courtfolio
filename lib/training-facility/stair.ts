/**
 * Stair-climber detail-view aggregation helpers (PRD §7.4).
 *
 * Pure functions used by the Gym stair detail route to slice cardio sessions
 * down to the stair modality, sum time-in-zone across the visible window, and
 * project per-session points for the avg-HR bar chart. Kept separate from the
 * React components so the math is unit-testable without RTL.
 */

import type { CardioSession, HrZone } from '@/types/cardio'
import { HR_ZONES, type HrZoneConfig } from '@/constants/hr-zones'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'

/**
 * Parse a session-date string as a local-time `Date`.
 *
 * Bare `YYYY-MM-DD` strings (the dominant format in `cardio.json` for stair
 * sessions) are treated as local midnight so range comparisons match the
 * `DateFilter`'s local-day bounds. Full ISO timestamps already carry an offset
 * and pass through to `new Date()` unchanged.
 *
 * Exported so the rendering layer (`StairDetailView`, table row formatter,
 * earliest-date scan) can stay consistent with how the aggregation layer
 * interprets the same field — single source of truth, no per-call-site
 * timezone divergence.
 *
 * @param raw - Original `date` field from a `CardioSession`.
 */
export function parseSessionDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`)
  return new Date(raw)
}

/**
 * Filter `sessions` down to stair-climbing entries whose `date` falls within
 * `range` (inclusive on both ends). Sessions with unparseable `date` strings
 * are dropped silently — the data layer is the right place to catch malformed
 * input, not a chart helper. Output is sorted oldest → newest so chart x-axes
 * read left-to-right by time.
 *
 * @param sessions - Full session list from `getCardioData()`.
 * @param range - Active range from the shared `DateFilter`.
 */
export function filterStairSessions(
  sessions: readonly CardioSession[],
  range: DateRange,
): CardioSession[] {
  const fromMs = range.start.getTime()
  const toMs = range.end.getTime()
  const out: { session: CardioSession; ts: number }[] = []
  for (const s of sessions) {
    if (s.activity !== 'stair') continue
    const ts = parseSessionDate(s.date).getTime()
    if (!Number.isFinite(ts)) continue
    if (ts < fromMs || ts > toMs) continue
    out.push({ session: s, ts })
  }
  out.sort((a, b) => a.ts - b.ts)
  return out.map((entry) => entry.session)
}

/** One row in the HR-zone distribution chart. */
export interface HrZoneBucket {
  /** Zone identifier (`Z1`–`Z5`). */
  zone: HrZoneConfig['id']
  /** Long zone label (e.g. "Aerobic Base"). */
  label: string
  /** Short axis label (e.g. "Z2"). */
  shortLabel: string
  /** Display color from the zone config. */
  color: string
  /** Total seconds spent in this zone across the filtered sessions. */
  seconds: number
}

/**
 * Sum the `hr_seconds_in_zone` field across a list of stair sessions, returning
 * one bucket per zone (Z1–Z5) in canonical order. Sessions missing the field
 * contribute zero — they don't drop the zone from the result, so the chart
 * always shows all five bars regardless of data quality.
 *
 * @param sessions - Already-filtered session list (e.g. from `filterStairSessions`).
 */
export function aggregateHrZoneSeconds(sessions: readonly CardioSession[]): HrZoneBucket[] {
  const totals: Record<HrZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const s of sessions) {
    const z = s.hr_seconds_in_zone
    if (!z) continue
    totals[1] += z[1] ?? 0
    totals[2] += z[2] ?? 0
    totals[3] += z[3] ?? 0
    totals[4] += z[4] ?? 0
    totals[5] += z[5] ?? 0
  }
  return HR_ZONES.map((z, i) => ({
    zone: z.id,
    label: z.label,
    shortLabel: z.shortLabel,
    color: z.color,
    seconds: totals[(i + 1) as HrZone],
  }))
}

/** One point on the per-session avg-HR bar chart. */
export interface SessionAvgHrPoint {
  /** Original session date string (ISO or `YYYY-MM-DD`). */
  date: string
  /** Short label rendered on the x-axis — `M/D` in local time. */
  label: string
  /** Average heart rate, BPM. Sessions missing `avg_hr` are excluded upstream. */
  avgHr: number
}

/**
 * Project a session list to the points needed by the avg-HR bar chart. Sessions
 * without an `avg_hr` field are excluded — there's nothing to render and a zero
 * bar would lie about coverage. The output preserves input order, so callers
 * pass a chronologically-sorted list (e.g. from `filterStairSessions`) to get
 * left-to-right time ordering.
 *
 * @param sessions - Filtered, sorted stair sessions.
 */
export function perSessionAvgHr(sessions: readonly CardioSession[]): SessionAvgHrPoint[] {
  const out: SessionAvgHrPoint[] = []
  for (const s of sessions) {
    if (typeof s.avg_hr !== 'number') continue
    const d = parseSessionDate(s.date)
    if (!Number.isFinite(d.getTime())) continue
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    out.push({ date: s.date, label, avgHr: s.avg_hr })
  }
  return out
}

/**
 * Format a duration in seconds as a compact `Mm Ss` string (e.g. `32m 05s`).
 * Used by the session log table; kept here so the test suite can exercise the
 * formatter without spinning up RTL.
 *
 * Negative or non-finite inputs return `—` rather than `NaNm`/`-1m`, so a
 * malformed entry doesn't pollute the table.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}
