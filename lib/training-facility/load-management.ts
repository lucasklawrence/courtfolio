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
/**
 * Trailing days in the chronic window; ÷4 gives the chronic weekly
 * baseline. Also the length of each movement's sparkline, so the sparkline
 * and the chronic total are always the same 28 days of data.
 */
const CHRONIC_DAYS = 28
/**
 * Fraction of a movement's *in-window* sets that must carry external load
 * before it's treated as a loaded movement (driven by load-volume) rather
 * than a bodyweight one (driven by rep volume). At `0.5`, an all-weighted
 * movement like shrugs uses tonnage while a mostly-bodyweight movement
 * like pull-ups stays rep-based even if it has the occasional weighted
 * set. Decided over the chronic window (not all history) so a movement
 * that recently switched loading regime is scored on its current scale.
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
   * (`(acute − prior) ÷ prior`), rounded to whole percent so the card's
   * displayed number and its flag color are computed from the same value
   * and can never disagree at the threshold. `null` when `prior7d` is `0`
   * (a brand-new ramp with no week to compare against).
   */
  wowPct: number | null
  /**
   * Acute:chronic workload ratio (`acute7d ÷ chronicWeekly`), rounded to
   * two decimals to match the displayed value. `null` until the movement's
   * history spans the full chronic window — ACWR's baseline is a 4-week
   * average, and dividing a partial window by 4 would raise a false alarm,
   * so a young movement shows no ratio rather than a misleading one.
   */
  acwr: number | null
  /** Overall flag — the worst of {@link wowFlag} and {@link acwrFlag}. */
  flag: RampFlag
  /** Flag from the WoW signal alone. */
  wowFlag: RampFlag
  /** Flag from the ACWR signal alone. */
  acwrFlag: RampFlag
  /** Trailing {@link CHRONIC_DAYS}-day daily volume, oldest → newest. */
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

  // Precompute the trailing chronic-window day keys once — they're shared
  // by every movement. Index 0 is today; index CHRONIC_DAYS-1 is the
  // window's oldest day. This replaces per-set/per-window `shiftDayKey`
  // calls (which built dozens of throwaway Dates per movement) with a
  // single O(1) offset lookup keyed on the Pacific day.
  const trailingKeys: string[] = []
  for (let i = 0; i < CHRONIC_DAYS; i++) trailingKeys.push(shiftDayKey(todayKey, -i))
  const offsetByKey = new Map(trailingKeys.map((key, i) => [key, i]))
  const chronicStartKey = trailingKeys[CHRONIC_DAYS - 1]

  const byExercise = new Map<string, StrengthSet[]>()
  for (const s of sets) {
    const arr = byExercise.get(s.exercise)
    if (arr) arr.push(s)
    else byExercise.set(s.exercise, [s])
  }

  const loads: MovementLoad[] = []
  for (const [movement, exSets] of byExercise) {
    // Bucket every set into the trailing window as BOTH rep volume and
    // load volume; pick which one drives the ramp math afterward from the
    // sets that actually fall inside the window. Tracking both means a
    // movement that switched loading regime (weighted → bodyweight) is
    // scored on its current scale instead of vanishing to zero tonnage.
    const repByOffset: number[] = new Array(CHRONIC_DAYS).fill(0)
    const loadByOffset: number[] = new Array(CHRONIC_DAYS).fill(0)
    let inWindowSets = 0
    let inWindowWeighted = 0
    let earliestKey: string | null = null

    for (const s of exSets) {
      const d = new Date(s.logged_at)
      if (!Number.isFinite(d.getTime())) continue
      const key = pacificDayKey(d)
      if (earliestKey === null || key < earliestKey) earliestKey = key
      const offset = offsetByKey.get(key)
      if (offset === undefined) continue // outside the trailing chronic window
      const weight = typeof s.weight_lbs === 'number' && s.weight_lbs > 0 ? s.weight_lbs : 0
      repByOffset[offset] += s.reps
      loadByOffset[offset] += s.reps * weight
      inWindowSets += 1
      if (weight > 0) inWindowWeighted += 1
    }

    // Dormant movement — nothing in the trailing chronic window. Skip so
    // the panel only shows what's actively being ramped.
    if (inWindowSets === 0) continue

    const loaded = inWindowWeighted / inWindowSets >= LOADED_SET_FRACTION
    const volByOffset = loaded ? loadByOffset : repByOffset

    let chronic28d = 0
    for (let i = 0; i < CHRONIC_DAYS; i++) chronic28d += volByOffset[i]
    // A loaded movement whose only in-window sets carry no external load
    // has zero tonnage — nothing to ramp. Skip it.
    if (chronic28d <= 0) continue

    let acute7d = 0
    for (let i = 0; i < ACUTE_DAYS; i++) acute7d += volByOffset[i]
    let prior7d = 0
    for (let i = ACUTE_DAYS; i < 2 * ACUTE_DAYS; i++) prior7d += volByOffset[i]

    const wowExact = prior7d === 0 ? null : (acute7d - prior7d) / prior7d
    // Round to the precision the card renders so the displayed number and
    // the flag color are derived from one value — no "+10% tinted yellow".
    const wowPct = wowExact === null ? null : Math.round(wowExact * 100) / 100

    // ACWR is trustworthy only once the chronic window is a full 4 weeks of
    // the movement's life; before that its ÷4 baseline is understated and
    // would false-alarm. Show no ratio until the earliest set predates the
    // window (ISO day keys compare lexically).
    const chronicWeekly = chronic28d / (CHRONIC_DAYS / ACUTE_DAYS)
    const hasChronicBase = earliestKey !== null && earliestKey <= chronicStartKey
    const acwrExact = hasChronicBase ? acute7d / chronicWeekly : null
    const acwr = acwrExact === null ? null : Math.round(acwrExact * 100) / 100

    const wowFlag = classifyWowPct(wowPct)
    const acwrFlag = classifyAcwr(acwr)

    const sparkline: DailyVolumePoint[] = []
    for (let i = CHRONIC_DAYS - 1; i >= 0; i--) {
      sparkline.push({ dayKey: trailingKeys[i], volume: volByOffset[i] })
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
