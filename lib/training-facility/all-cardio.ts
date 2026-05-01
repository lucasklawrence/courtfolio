/**
 * All-cardio overview helpers (PRD §7.4 — "All Cardio" view).
 *
 * Activity-agnostic filter and projection helpers that aggregate stair, running,
 * and walking sessions into a single overview. Pairs with `AllCardioOverview`
 * (the stats-wall page) and a per-activity-tinted `AvgHrBarsByActivity` variant.
 *
 * Activity-specific filters (`filterStairSessions`, `filterRunningSessions`,
 * `filterWalkingSessions`) stay in their respective modules. This module is the
 * only place where the cross-activity aggregations live so per-equipment views
 * don't accidentally start computing combined totals.
 */

import type { CardioActivity, CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import { parseSessionDate, type SessionAvgHrPoint } from './cardio-shared'

/**
 * Filter `sessions` to entries whose `date` falls within `range` (inclusive
 * on both ends), regardless of activity. Sessions with unparseable dates are
 * dropped silently — same contract as {@link filterCardioSessionsByActivity}.
 * Output is sorted oldest → newest so chart x-axes read left-to-right by time.
 *
 * @param sessions - Full session list from `getCardioData()`.
 * @param range - Active range from the shared `DateFilter`.
 */
export function filterAllCardioSessions(
  sessions: readonly CardioSession[],
  range: DateRange,
): CardioSession[] {
  const fromMs = range.start.getTime()
  const toMs = range.end.getTime()
  const out: { session: CardioSession; ts: number }[] = []
  for (const s of sessions) {
    const ts = parseSessionDate(s.date).getTime()
    if (!Number.isFinite(ts)) continue
    if (ts < fromMs || ts > toMs) continue
    out.push({ session: s, ts })
  }
  out.sort((a, b) => a.ts - b.ts)
  return out.map((entry) => entry.session)
}

/** Summary totals across the filtered session list (PRD §7.4 stats-wall row). */
export interface AllCardioSummary {
  /** Number of sessions in the filtered window. */
  sessionCount: number
  /** Sum of `duration_seconds` across the window. */
  totalDurationSeconds: number
  /** Sum of `distance_meters` across the window — stair sessions contribute zero. */
  totalDistanceMeters: number
  /** Average `duration_seconds` per session, or `null` when the window is empty. */
  avgDurationSeconds: number | null
}

/**
 * Aggregate session-count, total time, total distance, and avg duration over
 * a pre-filtered session list. Used by the All-Cardio overview's summary row
 * and by the wall-scoreboard "this week" totals once those wire up to real
 * data. Pure — does no date math or activity filtering itself; the caller is
 * responsible for passing the right slice of sessions.
 *
 * @param sessions - Already-filtered session list.
 */
export function summarizeAllCardio(sessions: readonly CardioSession[]): AllCardioSummary {
  let totalDurationSeconds = 0
  let totalDistanceMeters = 0
  for (const s of sessions) {
    if (Number.isFinite(s.duration_seconds)) totalDurationSeconds += s.duration_seconds
    if (typeof s.distance_meters === 'number' && Number.isFinite(s.distance_meters)) {
      totalDistanceMeters += s.distance_meters
    }
  }
  const sessionCount = sessions.length
  const avgDurationSeconds = sessionCount === 0 ? null : totalDurationSeconds / sessionCount
  return {
    sessionCount,
    totalDurationSeconds,
    totalDistanceMeters,
    avgDurationSeconds,
  }
}

/** One row in the activity-mix breakdown — sessions and total time per activity. */
export interface ActivityCount {
  /** Activity identifier (`stair` | `running` | `walking`). */
  activity: CardioActivity
  /** Number of sessions of this activity in the filtered window. */
  sessionCount: number
  /** Sum of `duration_seconds` across this activity's sessions. */
  totalDurationSeconds: number
}

/** Canonical activity ordering used across the overview surfaces. */
export const ACTIVITY_ORDER: readonly CardioActivity[] = ['stair', 'running', 'walking']

/**
 * Group `sessions` by activity and return one row per activity in canonical
 * order — even activities with zero sessions show up so the breakdown reads
 * as a stable shape regardless of which activities the window covers. Used by
 * the activity-mix legend below the avg-HR-by-activity chart.
 *
 * @param sessions - Already-filtered session list.
 */
export function countByActivity(sessions: readonly CardioSession[]): ActivityCount[] {
  const totals: Record<CardioActivity, ActivityCount> = {
    stair: { activity: 'stair', sessionCount: 0, totalDurationSeconds: 0 },
    running: { activity: 'running', sessionCount: 0, totalDurationSeconds: 0 },
    walking: { activity: 'walking', sessionCount: 0, totalDurationSeconds: 0 },
  }
  for (const s of sessions) {
    const bucket = totals[s.activity]
    if (!bucket) continue
    bucket.sessionCount += 1
    if (Number.isFinite(s.duration_seconds)) {
      bucket.totalDurationSeconds += s.duration_seconds
    }
  }
  return ACTIVITY_ORDER.map((a) => totals[a])
}

/**
 * One point on the activity-tinted avg-HR chart. Extends the activity-agnostic
 * {@link SessionAvgHrPoint} with the originating activity so the bar chart can
 * pick a per-bar color from {@link ACTIVITY_VISUALS}.
 */
export interface SessionAvgHrByActivityPoint extends SessionAvgHrPoint {
  /** Activity that produced this session — drives the bar tint. */
  activity: CardioActivity
}

/**
 * Project a session list to the points needed by the activity-tinted avg-HR
 * bar chart. Same contract as {@link perSessionAvgHr} (drops sessions missing
 * `avg_hr` or with unparseable dates) but threads the activity through so the
 * caller can color bars without joining back to the original session list.
 *
 * @param sessions - Filtered, sorted sessions.
 */
export function perSessionAvgHrByActivity(
  sessions: readonly CardioSession[],
): SessionAvgHrByActivityPoint[] {
  const out: SessionAvgHrByActivityPoint[] = []
  for (const s of sessions) {
    if (typeof s.avg_hr !== 'number') continue
    const d = parseSessionDate(s.date)
    if (!Number.isFinite(d.getTime())) continue
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    out.push({ date: s.date, label, avgHr: s.avg_hr, activity: s.activity })
  }
  return out
}

/** Display copy + tint for an activity — single source of truth for the overview surfaces. */
export interface ActivityVisual {
  /** Activity identifier. */
  activity: CardioActivity
  /** Title-cased label (e.g. `"Stair"`). */
  label: string
  /** Hex fill color used for activity-tinted chart bars and legend dots. */
  color: string
}

/**
 * Per-activity visual config. Picked to be visually distinct and consistent
 * with the `chartPalette` family (rim-orange, hardwood-tan, ink-black) so the
 * overview reads as part of the same room as the per-equipment detail views.
 *
 * - **Stair**: rim-orange — primary modality (PRD §7.4: "front-and-center").
 * - **Running**: hardwood-tan — warm secondary, contrasts orange.
 * - **Walking**: cool indigo — distinct from the warm pair without resorting
 *   to neon (PRD §8: no neon, no Chart.js defaults).
 */
export const ACTIVITY_VISUALS: Readonly<Record<CardioActivity, ActivityVisual>> = {
  stair: { activity: 'stair', label: 'Stair', color: '#EA580C' },
  running: { activity: 'running', label: 'Running', color: '#C9A268' },
  walking: { activity: 'walking', label: 'Walking', color: '#4F6D8E' },
}
