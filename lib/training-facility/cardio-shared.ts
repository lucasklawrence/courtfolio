/**
 * Shared cardio detail-view helpers (PRD §7.4).
 *
 * Activity-agnostic pure functions used by every Gym detail surface — stair,
 * treadmill, track. Extracted out of `stair.ts` so the running/walking detail
 * views can pull the same `parseSessionDate`, time-in-zone aggregation, and
 * formatter without importing a sibling-equipment file.
 *
 * Activity-specific filters (`filterStairSessions`, `filterRunningSessions`,
 * etc.) stay in their respective modules and delegate to
 * {@link filterCardioSessionsByActivity} here so the equipment-specific public
 * APIs continue to read naturally at call sites.
 */

import type { CardioActivity, CardioSession, HrZone } from '@/types/cardio'
import { HR_ZONES, type HrZoneConfig } from '@/constants/hr-zones'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'

/**
 * Parse a session-date string as a local-time `Date`.
 *
 * Bare `YYYY-MM-DD` strings (the dominant format in `cardio.json` for
 * non-walking sessions) are treated as local midnight so range comparisons
 * match the `DateFilter`'s local-day bounds. Full ISO timestamps already carry
 * an offset and pass through to `new Date()` unchanged.
 *
 * Exported so every layer (filters, chart projections, table row formatters)
 * stays consistent on the local-vs-UTC interpretation of the same field.
 *
 * @param raw - Original `date` field from a `CardioSession`.
 */
export function parseSessionDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`)
  return new Date(raw)
}

/**
 * Filter `sessions` down to a single activity whose `date` falls within
 * `range` (inclusive on both ends). Sessions with unparseable `date` strings
 * are dropped silently — the data layer is the right place to catch malformed
 * input, not a chart helper. Output is sorted oldest → newest so chart x-axes
 * read left-to-right by time.
 *
 * @param sessions - Full session list from `getCardioData()`.
 * @param activity - `'stair'`, `'running'`, or `'walking'`.
 * @param range - Active range from the shared `DateFilter`.
 */
export function filterCardioSessionsByActivity(
  sessions: readonly CardioSession[],
  activity: CardioActivity,
  range: DateRange,
): CardioSession[] {
  const fromMs = range.start.getTime()
  const toMs = range.end.getTime()
  const out: { session: CardioSession; ts: number }[] = []
  for (const s of sessions) {
    if (s.activity !== activity) continue
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
 * Sum the `hr_seconds_in_zone` field across a list of sessions, returning
 * one bucket per zone (Z1–Z5) in canonical order. Sessions missing the field
 * contribute zero — they don't drop the zone from the result, so the chart
 * always shows all five bars regardless of data quality.
 *
 * @param sessions - Already-filtered session list.
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
  /**
   * Short label rendered on the x-axis. `M/D` in local time for per-session /
   * weekly points; `Mon 'YY` for monthly buckets (see {@link bucketAvgHr}).
   */
  label: string
  /** Average heart rate, BPM. Sessions missing `avg_hr` are excluded upstream. */
  avgHr: number
}

/**
 * Project a session list to the points needed by the avg-HR bar chart.
 * Sessions without an `avg_hr` field are excluded — there's nothing to render
 * and a zero bar would lie about coverage. Output preserves input order, so
 * callers pass a chronologically-sorted list to get left-to-right time
 * ordering.
 *
 * @param sessions - Filtered, sorted sessions.
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
 * Aggregation granularity for the avg-HR bar chart.
 *
 * - `session` — one bar per session (the raw {@link perSessionAvgHr} output).
 * - `week` — sessions collapsed to weekly means.
 * - `month` — sessions collapsed to monthly means.
 */
export type AvgHrGranularity = 'session' | 'week' | 'month'

/** Milliseconds in a day, for span math. */
const MS_PER_DAY = 86_400_000

/**
 * Whole-day span of a {@link DateRange}, used to pick chart aggregation.
 * Fractional because range bounds are local day edges, not whole days.
 *
 * @param range - Inclusive date window from the `DateFilter`.
 */
export function rangeSpanDays(range: DateRange): number {
  return (range.end.getTime() - range.start.getTime()) / MS_PER_DAY
}

/**
 * Choose avg-HR bar granularity from the visible span. Per-session bars stay
 * legible for a few months (`1M`/`3M`); past that they smear into an unreadable
 * picket fence, so wider windows roll up to weekly (`6M`/`1Y`) then monthly
 * (multi-year `All`) means.
 *
 * Thresholds: ≤ ~100 days → `session`, ≤ ~13 months → `week`, else `month`.
 *
 * @param spanDays - Visible window width in days (see {@link rangeSpanDays}).
 */
export function avgHrGranularityForSpanDays(spanDays: number): AvgHrGranularity {
  if (spanDays > 400) return 'month'
  if (spanDays > 100) return 'week'
  return 'session'
}

/** Local Monday 00:00 of the week containing `d` — the weekly bucket anchor. */
function weekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayOffset = (out.getDay() + 6) % 7 // Mon=0 … Sun=6
  out.setDate(out.getDate() - dayOffset)
  return out
}

/**
 * Collapse per-session avg-HR points into time buckets, averaging `avgHr`
 * within each bucket. `session` granularity (or an empty input) returns the
 * points unchanged. Input must be chronologically sorted; buckets come out in
 * that same order. Each bucket's `date` is its first session's date and its
 * `label` reflects the granularity — `M/D` of the week start for `week`,
 * `Mon 'YY` for `month`.
 *
 * @param points - Per-session points from {@link perSessionAvgHr}, sorted ascending.
 * @param granularity - Bucket size, typically from {@link avgHrGranularityForSpanDays}.
 */
export function bucketAvgHr(
  points: readonly SessionAvgHrPoint[],
  granularity: AvgHrGranularity,
): SessionAvgHrPoint[] {
  if (granularity === 'session' || points.length === 0) return [...points]

  const groups = new Map<string, { sum: number; count: number; anchor: Date; date: string }>()
  const order: string[] = []
  for (const p of points) {
    const d = parseSessionDate(p.date)
    if (!Number.isFinite(d.getTime())) continue
    const anchor = granularity === 'month' ? new Date(d.getFullYear(), d.getMonth(), 1) : weekStart(d)
    const key = `${anchor.getFullYear()}-${anchor.getMonth()}-${anchor.getDate()}`
    let g = groups.get(key)
    if (!g) {
      g = { sum: 0, count: 0, anchor, date: p.date }
      groups.set(key, g)
      order.push(key)
    }
    g.sum += p.avgHr
    g.count += 1
  }

  return order.map((key) => {
    const g = groups.get(key)!
    const label =
      granularity === 'month'
        ? `${g.anchor.toLocaleDateString(undefined, { month: 'short' })} '${String(g.anchor.getFullYear()).slice(-2)}`
        : `${g.anchor.getMonth() + 1}/${g.anchor.getDate()}`
    return { date: g.date, label, avgHr: g.sum / g.count }
  })
}

/**
 * Format a duration in seconds as a compact `Mm Ss` string (e.g. `32m 05s`).
 *
 * Negative or non-finite inputs return `—` rather than `NaNm`/`-1m`, so a
 * malformed entry doesn't pollute a table.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}

/**
 * Build the per-session detail page URL (#165) for a session-log row.
 * Centralizes the `encodeURIComponent` step so each session-log table
 * encodes the timestamp identically — the route handler decodes once on
 * the server. ISO timestamps contain `:` and `+`, both of which need
 * percent-encoding to survive the URL path segment.
 *
 * @param startedAt The session's `started_at` (`CardioSession.date`)
 *   ISO timestamp string. Empty input returns the route root, which 404s
 *   in the page handler — same outcome as a missing session.
 */
export function sessionDetailHref(startedAt: string): string {
  return `/training-facility/gym/session/${encodeURIComponent(startedAt)}`
}
