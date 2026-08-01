import {
  classifyAcwr,
  classifyWowPct,
  combineFlags,
  FLAG_SEVERITY,
  type RampFlag,
} from '@/constants/ramp-rate'
import type {
  ExerciseEquipment,
  ExerciseGoal,
  StrengthSet,
  WeightRoomExercise,
} from '@/types/weight-room'

import { pacificDayKey, shiftDayKey } from './day-keys'

/**
 * Ramp-rate aggregation for the Weight Room Load Management panel (#316).
 *
 * Turns raw {@link StrengthSet} rows into a per-movement view of how fast
 * volume is climbing relative to the tendon's recent baseline. All
 * calendar bucketing is anchored to **Pacific time**
 * ({@link import('./day-keys').PACIFIC_TZ}),
 * not the server's local zone — on Vercel the server runs in UTC, so
 * bucketing in local time would silently shift every day boundary. The
 * thresholds that turn these numbers into flags live in
 * {@link import('@/constants/ramp-rate').RAMP_RATE_THRESHOLDS}.
 *
 * Windows are **calendar-day** windows (not "last N sets"), so a rest day
 * contributes a real zero and correctly drags the acute load down.
 */

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
 *
 * Since #384 this is the *fallback*: a movement in the exercise catalog is
 * classified from its `equipment` instead — see {@link isLoadDriven}. The
 * threshold still decides movements the catalog doesn't know, and still
 * decides bodyweight movements that carry added load.
 */
const LOADED_SET_FRACTION = 0.5

/** Movement color when no matching {@link ExerciseGoal} supplies one. Rim-orange. */
const DEFAULT_MOVEMENT_COLOR = '#EA580C'

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
  /**
   * Human label for {@link movement}, from the catalog's `display_name`
   * (#384). Absent falls back to the slug at the render site.
   */
  displayName?: string
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
 * Decide whether a movement's ramp is driven by **load volume** (tonnage) or
 * **rep volume**.
 *
 * Catalog-first as of #384: `equipment` states how a movement is loaded, which
 * is a fact rather than the inference the share-of-weighted-sets threshold was
 * making. Two deliberate exceptions keep it honest:
 *
 * - **A bodyweight movement that carries added load still falls back to the
 *   threshold.** Weighted pull-ups and dip-belt dips are `equipment:
 *   'bodyweight'` but their stress genuinely is load-driven once the belt goes
 *   on, and the catalog can't know that from the movement alone.
 * - **A loaded movement with nothing weighted in the window falls back to
 *   reps.** Trusting the catalog there would score it by a tonnage of zero,
 *   and the caller drops zero-volume movements — so a barbell movement logged
 *   without loads would silently vanish from the panel instead of showing its
 *   rep volume.
 *
 * `'other'` is treated as *unclassified*, not as a loaded implement. It's the
 * fallback `ensureWeightRoomExercise` stamps on any movement provisioned by the
 * goal form or the monthly-focus anchor, so it means "nobody has said yet" —
 * reading it as loaded would score a mostly-bodyweight new movement by tonnage
 * off a single weighted set. A movement absent from the catalog entirely gets
 * the same treatment, so both keep the pre-#384 behavior exactly.
 *
 * @param equipment The movement's catalog equipment, or `undefined` when it has
 *   no catalog row.
 * @param inWindowSets Sets inside the chronic window. Never `0` — the caller
 *   skips dormant movements before calling.
 * @param inWindowWeighted How many of those carried a positive `weight_lbs`.
 */
function isLoadDriven(
  equipment: ExerciseEquipment | undefined,
  inWindowSets: number,
  inWindowWeighted: number,
): boolean {
  const meetsThreshold = inWindowWeighted / inWindowSets >= LOADED_SET_FRACTION
  // Unknown classification, or a bodyweight movement that may be carrying
  // added load — the sets are the better evidence in both cases.
  if (equipment === undefined || equipment === 'other' || equipment === 'bodyweight') {
    return meetsThreshold
  }
  return inWindowWeighted > 0
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
 * @param exercises the movement catalog (#384), used to classify each movement
 *   as load- or rep-driven from its `equipment` rather than guessing from the
 *   share of weighted sets. Omitted or missing a movement falls back to the
 *   pre-#384 threshold — see {@link isLoadDriven}.
 */
export function buildMovementLoads(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[] = [],
  now: Date = new Date(),
  exercises: readonly WeightRoomExercise[] = [],
): MovementLoad[] {
  const todayKey = pacificDayKey(now)
  const colorByExercise = new Map(goals.map(g => [g.exercise, g.color]))
  const equipmentByExercise = new Map(exercises.map(e => [e.slug, e.equipment]))
  const labelByExercise = new Map(exercises.map(e => [e.slug, e.display_name]))

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

    const loaded = isLoadDriven(
      equipmentByExercise.get(movement),
      inWindowSets,
      inWindowWeighted,
    )
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
      displayName: labelByExercise.get(movement),
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
