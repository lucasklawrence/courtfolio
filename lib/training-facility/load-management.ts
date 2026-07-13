import {
  classifyAcwr,
  classifyWowPct,
  combineFlags,
  FLAG_SEVERITY,
  type RampFlag,
} from '@/constants/ramp-rate'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/**
 * Ramp-rate aggregation for the Weight Room Load Management panel (#316).
 *
 * Turns raw {@link StrengthSet} rows into a per-movement view of how fast
 * volume is climbing relative to the tendon's recent baseline. All
 * calendar bucketing is anchored to **Pacific time** ({@link PACIFIC_TZ}),
 * not the server's local zone — on Vercel the server runs in UTC, so
 * bucketing in local time would silently shift every day boundary. The
 * thresholds that turn these numbers into flags live in
 * {@link import('@/constants/ramp-rate').RAMP_RATE_THRESHOLDS}.
 *
 * Windows are **calendar-day** windows (not "last N sets"), so a rest day
 * contributes a real zero and correctly drags the acute load down.
 */

/** IANA zone every day/week bucket is anchored to. Never bucket on raw UTC. */
export const PACIFIC_TZ = 'America/Los_Angeles'

/** Trailing days in the acute window. */
const ACUTE_DAYS = 7
/** Trailing days in the chronic window; ÷4 gives the chronic weekly baseline. */
const CHRONIC_DAYS = 28
/** Trailing days rendered in each movement's sparkline. */
const SPARKLINE_DAYS = 28
/**
 * Fraction of a movement's sets that must carry external load before it's
 * treated as a loaded movement (driven by load-volume) rather than a
 * bodyweight one (driven by rep volume). At `0.5`, an all-weighted
 * movement like shrugs uses tonnage while a mostly-bodyweight movement
 * like pull-ups stays rep-based even if it has the occasional weighted
 * set.
 */
const LOADED_SET_FRACTION = 0.5

/** Movement color when no matching {@link ExerciseGoal} supplies one. Rim-orange. */
const DEFAULT_MOVEMENT_COLOR = '#EA580C'

/** Reused Pacific date formatter — constructing one per call is expensive. */
const PACIFIC_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: PACIFIC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The `YYYY-MM-DD` **Pacific** calendar day a timestamp falls on. A set
 * logged at `2026-07-12T05:00:00Z` (10pm PT on the 11th) buckets to
 * `2026-07-11`. Assembled from `formatToParts` rather than string-parsing
 * the formatter output so a locale/ICU quirk can't reorder the fields.
 *
 * @param d any `Date`; callers pass `new Date(set.logged_at)`.
 */
export function pacificDayKey(d: Date): string {
  const parts = PACIFIC_DATE_FORMAT.formatToParts(d)
  let year = ''
  let month = ''
  let day = ''
  for (const part of parts) {
    if (part.type === 'year') year = part.value
    else if (part.type === 'month') month = part.value
    else if (part.type === 'day') day = part.value
  }
  return `${year}-${month}-${day}`
}

/**
 * Shift a `YYYY-MM-DD` calendar key by `delta` days. Arithmetic runs in
 * UTC on the bare calendar numbers (no zone, no DST), so the returned key
 * is always a clean calendar date — never off-by-an-hour onto the wrong
 * day the way raw millisecond math can be across a DST transition.
 */
function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Sum `days` of daily volume ending at (and including) `endKey`, reading
 * missing days as zero.
 */
function sumWindow(volByDay: ReadonlyMap<string, number>, endKey: string, days: number): number {
  let total = 0
  for (let i = 0; i < days; i++) {
    total += volByDay.get(shiftDayKey(endKey, -i)) ?? 0
  }
  return total
}

/** One point in a movement's trailing daily-volume sparkline. */
export interface DailyVolumePoint {
  /** `YYYY-MM-DD` Pacific calendar day. */
  dayKey: string
  /** Total primary-metric volume logged that day. `0` on rest days. */
  volume: number
}

/**
 * A single movement's ramp-rate readout — one card on the Load Management
 * panel. Volume is measured in the movement's *primary metric*: rep count
 * for bodyweight movements, load-volume (`Σ reps × weight_lbs`) for
 * predominantly weighted ones (see {@link MovementLoad.metric}).
 */
export interface MovementLoad {
  /** Exercise name, verbatim from the set rows (e.g. `pullups`). */
  movement: string
  /** Hex display color from the matching {@link ExerciseGoal}, or a default. */
  color: string
  /** Which volume the ramp math is computed on. */
  metric: 'reps' | 'load'
  /** Unit suffix for display — `reps` or `lb`. */
  unitLabel: string
  /** Trailing-7-day (acute) volume. */
  acute7d: number
  /** The 7 days before the acute window — the WoW comparison base. */
  prior7d: number
  /** Trailing-28-day (chronic) volume. */
  chronic28d: number
  /** Chronic weekly baseline — `chronic28d ÷ 4`. The ACWR denominator. */
  chronicWeekly: number
  /**
   * Week-over-week fractional change of the trailing-7 volume
   * (`(acute − prior) ÷ prior`). `null` when `prior7d` is `0` (a
   * brand-new ramp with no week to compare against).
   */
  wowPct: number | null
  /**
   * Acute:chronic workload ratio (`acute7d ÷ chronicWeekly`). Always
   * finite for a rendered movement, since movements with no chronic
   * volume are filtered out.
   */
  acwr: number | null
  /** Overall flag — the worst of {@link wowFlag} and {@link acwrFlag}. */
  flag: RampFlag
  /** Flag from the WoW signal alone. */
  wowFlag: RampFlag
  /** Flag from the ACWR signal alone. */
  acwrFlag: RampFlag
  /** Trailing {@link SPARKLINE_DAYS}-day daily volume, oldest → newest. */
  sparkline: DailyVolumePoint[]
}

/**
 * Build one {@link MovementLoad} per actively-ramped movement from raw
 * set rows. A movement is included only when it has volume in the
 * trailing 28-day chronic window — dormant movements (last trained months
 * ago) are dropped so the panel stays focused on what's currently loading
 * tissue. Movements are returned worst-flag-first, then alphabetically,
 * so anything elevated sorts to the top.
 *
 * The movement list is derived from the *data*, not a hardcoded set of
 * exercises, so new movements appear automatically. `goals` only supplies
 * display color; a movement with sets but no configured goal still shows.
 *
 * @param sets every logged set from
 *   {@link import('@/types/weight-room').WeightRoomData.sets}.
 * @param goals configured exercise goals, used purely for per-movement
 *   color lookup.
 * @param now override for the "today" anchor of every window. Defaults to
 *   `new Date()`; tests pass a fixed instant for determinism.
 */
export function buildMovementLoads(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[] = [],
  now: Date = new Date(),
): MovementLoad[] {
  const todayKey = pacificDayKey(now)
  const colorByExercise = new Map(goals.map(g => [g.exercise, g.color]))

  const byExercise = new Map<string, StrengthSet[]>()
  for (const s of sets) {
    const arr = byExercise.get(s.exercise)
    if (arr) arr.push(s)
    else byExercise.set(s.exercise, [s])
  }

  const loads: MovementLoad[] = []
  for (const [movement, exSets] of byExercise) {
    // Primary metric: load-volume when the movement is predominantly
    // weighted, else reps. Decided over all sets so an occasional
    // weighted rep on a bodyweight movement doesn't flip its whole scale.
    const weightedCount = exSets.filter(
      s => typeof s.weight_lbs === 'number' && s.weight_lbs > 0,
    ).length
    const loaded = exSets.length > 0 && weightedCount / exSets.length >= LOADED_SET_FRACTION

    const volByDay = new Map<string, number>()
    for (const s of exSets) {
      const d = new Date(s.logged_at)
      if (!Number.isFinite(d.getTime())) continue
      const key = pacificDayKey(d)
      const vol = loaded ? s.reps * (s.weight_lbs ?? 0) : s.reps
      volByDay.set(key, (volByDay.get(key) ?? 0) + vol)
    }

    const chronic28d = sumWindow(volByDay, todayKey, CHRONIC_DAYS)
    // Dormant movement — nothing in the trailing chronic window. Skip so
    // the panel only shows what's actively being ramped.
    if (chronic28d <= 0) continue

    const acute7d = sumWindow(volByDay, todayKey, ACUTE_DAYS)
    const prior7d = sumWindow(volByDay, shiftDayKey(todayKey, -ACUTE_DAYS), ACUTE_DAYS)
    const chronicWeekly = chronic28d / (CHRONIC_DAYS / ACUTE_DAYS)

    const wowPct = prior7d === 0 ? null : (acute7d - prior7d) / prior7d
    const acwr = chronicWeekly === 0 ? null : acute7d / chronicWeekly

    const wowFlag = classifyWowPct(wowPct)
    const acwrFlag = classifyAcwr(acwr)

    const sparkline: DailyVolumePoint[] = []
    for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
      const key = shiftDayKey(todayKey, -i)
      sparkline.push({ dayKey: key, volume: volByDay.get(key) ?? 0 })
    }

    loads.push({
      movement,
      color: colorByExercise.get(movement) ?? DEFAULT_MOVEMENT_COLOR,
      metric: loaded ? 'load' : 'reps',
      unitLabel: loaded ? 'lb' : 'reps',
      acute7d,
      prior7d,
      chronic28d,
      chronicWeekly,
      wowPct,
      acwr,
      flag: combineFlags(wowFlag, acwrFlag),
      wowFlag,
      acwrFlag,
      sparkline,
    })
  }

  loads.sort(
    (a, b) => FLAG_SEVERITY[b.flag] - FLAG_SEVERITY[a.flag] || a.movement.localeCompare(b.movement),
  )
  return loads
}
