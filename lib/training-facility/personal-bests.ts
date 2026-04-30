/**
 * Personal-best detection for the Gym detail views (#76, PRD §7.4).
 *
 * Pure functions over the {@link CardioData} shape. The PB set is:
 * - **pace** — fastest pace per activity (lowest seconds-per-km).
 * - **duration** — longest single session per activity (most seconds).
 * - **distance** — longest single session per activity (most meters).
 * - **restingHr** — lowest resting heart rate from the daily trend (cross-cutting).
 * - **vo2max** — highest VO2max from the daily trend (cross-cutting).
 *
 * "Flights climbed" from the original dashboard PRD is omitted — the v1
 * `CardioSession` schema doesn't carry that field; if/when it lands the
 * shape here can grow without breaking call sites.
 *
 * All helpers ignore non-finite, zero, or negative values (Apple Health
 * exports occasionally use those as missing-data sentinels), so a malformed
 * row never wins a PB.
 */

import type {
  CardioActivity,
  CardioData,
  CardioSession,
  CardioTimePoint,
} from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'

/** A single personal-best record — a value plus the date it was achieved. */
export interface PersonalBestRecord {
  /** The PB value. Units depend on the metric (pace = sec/km, duration = sec, etc.). */
  value: number
  /** ISO date string of the session or trend point that holds the PB. */
  date: string
}

/**
 * All-time personal bests grouped by metric. Per-activity buckets are
 * `Partial<Record<...>>` because some activities lack data (e.g. stair
 * sessions don't have pace).
 */
export interface PersonalBests {
  /** Fastest pace per activity, in seconds-per-km (lower = better). */
  pace: Partial<Record<CardioActivity, PersonalBestRecord>>
  /** Longest session duration per activity, in seconds (higher = better). */
  duration: Partial<Record<CardioActivity, PersonalBestRecord>>
  /** Longest session distance per activity, in meters (higher = better). */
  distance: Partial<Record<CardioActivity, PersonalBestRecord>>
  /** Lowest resting heart rate over the imported trend, BPM. Cross-cutting. */
  restingHr?: PersonalBestRecord
  /** Highest VO2max over the imported trend. Cross-cutting. */
  vo2max?: PersonalBestRecord
}

/** Direction of "better" for a metric — lower wins (pace, HR) or higher wins (duration, distance, VO2max). */
type Mode = 'min' | 'max'

/**
 * Numeric per-session fields eligible for PB detection. Restricted to fields
 * where "best" has a clear lower-or-higher interpretation; HR fields aren't
 * here because per-session HR isn't a meaningful PB (those are summaries, not
 * achievements).
 */
type SessionMetricField = 'pace_seconds_per_km' | 'duration_seconds' | 'distance_meters'

/**
 * Compute all-time personal bests from a full cardio dataset. Pure — no
 * side effects, no caching. Caller is responsible for invalidating the
 * computed PBs when the underlying dataset changes.
 *
 * @param data Full cardio dataset (sessions + resting-HR + VO2max trends).
 */
export function computePersonalBests(data: CardioData): PersonalBests {
  return {
    pace: bestPerActivity(data.sessions, 'pace_seconds_per_km', 'min'),
    duration: bestPerActivity(data.sessions, 'duration_seconds', 'max'),
    distance: bestPerActivity(data.sessions, 'distance_meters', 'max'),
    restingHr: bestTrendPoint(data.resting_hr_trend, 'min'),
    vo2max: bestTrendPoint(data.vo2max_trend, 'max'),
  }
}

/**
 * Find the best session in a list for a single metric, regardless of activity.
 * Used by the detail views to compute "best in the active filter range" for
 * the inline comparison line on each PB tile.
 *
 * @param sessions Pre-filtered session list (already scoped to the range).
 * @param field    The session metric to compare against.
 * @param mode     `'min'` for lower-is-better metrics (pace), `'max'` otherwise.
 */
export function bestSession(
  sessions: readonly CardioSession[],
  field: SessionMetricField,
  mode: Mode,
): PersonalBestRecord | undefined {
  let best: PersonalBestRecord | undefined
  for (const s of sessions) {
    const v = s[field]
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue
    if (!best || (mode === 'min' ? v < best.value : v > best.value)) {
      best = { value: v, date: s.date }
    }
  }
  return best
}

/**
 * Whether a PB record's date falls inside the active filter range — drives
 * the "PB SET" badge on the tile when the user's currently-viewed range
 * contains the all-time best session.
 *
 * Returns `false` for missing PBs (so the badge logic can branch on the
 * tile's value type without an extra null check).
 */
export function pbInRange(
  record: PersonalBestRecord | undefined,
  range: DateRange,
): boolean {
  if (!record) return false
  const ts = parseRecordDate(record.date).getTime()
  if (!Number.isFinite(ts)) return false
  return ts >= range.start.getTime() && ts <= range.end.getTime()
}

/**
 * Best point in a trend series whose date falls inside the active range.
 * Mirrors {@link bestSession} for trend (daily-measurement) data — used by
 * `PersonalBests` to render the "Best in range" comparator on the
 * cross-cutting tiles (resting HR, VO₂max) when the all-time PB is
 * *outside* the active filter range.
 *
 * @param points Full trend series (e.g. `data.resting_hr_trend`).
 * @param range  Active range from the shared `DateFilter`.
 * @param mode   `'min'` for lower-is-better metrics (resting HR), `'max'` otherwise.
 */
export function bestTrendInRange(
  points: readonly CardioTimePoint[],
  range: DateRange,
  mode: Mode,
): PersonalBestRecord | undefined {
  const fromMs = range.start.getTime()
  const toMs = range.end.getTime()
  let best: PersonalBestRecord | undefined
  for (const p of points) {
    if (typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value <= 0) continue
    const ts = parseRecordDate(p.date).getTime()
    if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) continue
    if (!best || (mode === 'min' ? p.value < best.value : p.value > best.value)) {
      best = { value: p.value, date: p.date }
    }
  }
  return best
}

/**
 * Per-activity bests for a session metric. Internal — sessions are grouped
 * by `s.activity` and the best session per group is kept.
 */
function bestPerActivity(
  sessions: readonly CardioSession[],
  field: SessionMetricField,
  mode: Mode,
): Partial<Record<CardioActivity, PersonalBestRecord>> {
  const out: Partial<Record<CardioActivity, PersonalBestRecord>> = {}
  for (const s of sessions) {
    const v = s[field]
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue
    const current = out[s.activity]
    if (!current || (mode === 'min' ? v < current.value : v > current.value)) {
      out[s.activity] = { value: v, date: s.date }
    }
  }
  return out
}

/**
 * Best point in a trend series — used for resting HR and VO2max which come
 * from daily trend arrays, not per-session data.
 */
function bestTrendPoint(
  points: readonly CardioTimePoint[],
  mode: Mode,
): PersonalBestRecord | undefined {
  let best: PersonalBestRecord | undefined
  for (const p of points) {
    if (typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value <= 0) continue
    if (!best || (mode === 'min' ? p.value < best.value : p.value > best.value)) {
      best = { value: p.value, date: p.date }
    }
  }
  return best
}

/**
 * Local-time `Date` parse for record date strings — `YYYY-MM-DD` becomes
 * local midnight so the `pbInRange` comparison aligns with the
 * `DateFilter`'s local-day bounds; full ISO timestamps pass through.
 *
 * Mirrors {@link parseSessionDate} from `cardio-shared.ts`; duplicated as a
 * tiny helper here to keep this module dependency-free of the chart layer.
 */
function parseRecordDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`)
  return new Date(raw)
}
