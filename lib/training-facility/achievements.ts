import type {
  AchievementMeasure,
  AchievementScope,
  ExerciseGoal,
  StrengthSet,
  WeightRoomAchievement,
  WeightRoomExercise,
} from '@/types/weight-room'

import { targetResolverFor } from './goal-targets'
import { mondayOfDayKey, safePacificDayKey, shiftDayKey } from './day-keys'

/**
 * Pure resolver for the Weight Room Trophy Room (#336) — "grease the groove"
 * achievements.
 *
 * The ladder ({@link WeightRoomAchievement}) is data-driven, loaded from
 * `weight_room_achievements` and editable in the admin settings page; nothing
 * here hardcodes a threshold. Given the full set log, the configured goals, and
 * the ladder, this module answers for every tier: is it earned, what's the best
 * you've done against that metric, when did you first earn it, and how many
 * times.
 *
 * STATELESS BY DESIGN, like the OTF mileage awards (#321): earned state is
 * never persisted. Everything is recomputed from `sets` on each render, so
 * retuning a threshold re-lights the wall immediately and a backdated set
 * retroactively earns what it should.
 *
 * This module is pure and isomorphic — no Supabase client, no React, no clock
 * (a streak's *longest* run and a badge's earn date are both facts about the
 * log, not about "now") — so it unit-tests cleanly and runs on either side of
 * the SSR/CSR boundary.
 *
 * All bucketing uses **Pacific** calendar days via {@link pacificDayKey}, and
 * ISO (Mon–Sun) weeks. Pacific rather than the runtime's local zone because the
 * Trophy Room renders in a Server Component and Vercel runs in UTC — a set
 * logged at 10pm Pacific would otherwise land on the following day, splitting
 * daily totals and breaking streaks that are actually intact. Same anchor as
 * `load-management.ts` (#319).
 */

/** Render order for scopes — volume ladders first, then the "how" scopes. */
const SCOPE_ORDER: readonly AchievementScope[] = [
  'day',
  'week',
  'month',
  'streak',
  'lifetime',
  'set',
]

/** Render order for measures within a scope — reps, then the load ladders. */
const MEASURE_ORDER: readonly AchievementMeasure[] = ['reps', 'tonnage', 'load']

/** Short section heading per scope, for the Trophy Room's grouped layout. */
export const SCOPE_LABELS: Readonly<Record<AchievementScope, string>> = {
  day: 'Single day',
  week: 'Single week',
  month: 'Single month',
  streak: 'Streak',
  lifetime: 'Lifetime',
  set: 'Single set',
}

/** Fallback emoji per scope when a tier carries no configured `icon`. */
const SCOPE_ICONS: Readonly<Record<AchievementScope, string>> = {
  day: '💯',
  week: '📅',
  month: '🏅',
  streak: '🔥',
  lifetime: '🎖️',
  set: '💪',
}

/** Display name for the pooled ladder wherever an exercise name would go. */
export const POOLED_LABEL = 'All movements'

/**
 * Heading for one subsection of a movement's ladder. Tiers are grouped by
 * scope *and* measure, so "100 reps in a day" and "10,000 lb in a day" don't
 * share a heading and look like contradictory thresholds.
 */
export function sectionLabel(scope: AchievementScope, measure: AchievementMeasure): string {
  if (measure === 'load') {
    return scope === 'set' ? 'Top-set load' : `${SCOPE_LABELS[scope]} · heaviest set`
  }
  if (measure === 'tonnage') return `${SCOPE_LABELS[scope]} · weight moved`
  return SCOPE_LABELS[scope]
}

/**
 * Per-metric aggregates for one exercise (or the pooled ladder), built once
 * from the set log and then queried by every tier that measures it.
 */
interface MovementMetrics {
  /** Local day key (`YYYY-MM-DD`) → reps logged that day. */
  byDay: Map<string, number>
  /** ISO-week Monday key (`YYYY-MM-DD`) → reps logged that week. */
  byWeek: Map<string, number>
  /** Calendar month key (`YYYY-MM`) → reps logged that month. */
  byMonth: Map<string, number>
  /** Local day key → pounds moved that day (`Σ reps × effective load`). */
  tonnageByDay: Map<string, number>
  /** ISO-week Monday key → pounds moved that week. */
  tonnageByWeek: Map<string, number>
  /** Calendar month key → pounds moved that month. */
  tonnageByMonth: Map<string, number>
  /**
   * Every set in chronological order — the `'set'` scope's source.
   *
   * `load` is the *effective* load: the logged per-implement `weight_lbs`
   * times the movement's `load_multiplier`, so a 60 lb two-dumbbell shrug
   * reads as the 120 lb it actually is. `tonnage` is `reps × load`. Both are
   * `0` for a bodyweight set.
   */
  sets: { day: string; reps: number; load: number; tonnage: number }[]
  /**
   * Day keys that met the daily target, ascending — the `'streak'` scope's
   * source. For a single exercise that's `reps >=` the target in effect *on
   * that day* (#362), not the goal's current one; for the pooled ladder it's
   * any day where *at least one* exercise hit its own target for that day.
   */
  hitDays: string[]
}

/** One ladder tier resolved against the log. */
export interface ResolvedAchievement {
  /** The tier being resolved. */
  achievement: WeightRoomAchievement
  /**
   * Human label for {@link WeightRoomAchievement.exercise} (#384), from the
   * catalog via the matching goal. Absent for pooled tiers (which own no
   * single movement) and for movements with no goal.
   */
  displayName?: string
  /** Whether {@link best} has reached the tier's threshold. */
  earned: boolean
  /**
   * Best value ever recorded against this tier's metric — the biggest single
   * day / week / month, the longest streak in days, the all-time rep total, or
   * the biggest single set. `0` when the exercise has no logged sets.
   */
  best: number
  /** `best / threshold`, clamped to `[0, 1]`. `1` exactly when {@link earned}. */
  progress: number
  /** Reps (or days, for `'streak'`) still needed; `0` once earned. */
  remaining: number
  /**
   * Every bucket in which the tier was earned, chronological. Most badges are
   * *repeatable*: each qualifying day / week / month / set earns it again, and
   * a streak re-earns it once per run that reaches the threshold. Two entries
   * can share a key — two 20-rep sets on the same day are two earns of a
   * `'set'` tier.
   *
   * Keys are day keys (`YYYY-MM-DD`) for every scope except `'month'`
   * (`YYYY-MM`). Format one with {@link formatEarnedOn}.
   *
   * `'lifetime'` is the one non-repeatable scope — a cumulative total is
   * crossed exactly once — so it holds at most one entry.
   */
  earnedOn: string[]
  /** How many times the tier has been earned; `earnedOn.length`. */
  timesEarned: number
  /** First time it was earned, or `null` if never. */
  firstEarnedOn: string | null
  /**
   * Most recent time it was earned, or `null` if never. Equals
   * {@link firstEarnedOn} for a badge earned exactly once. This is what the
   * Trophy Room's "recently raised" strip orders by, so re-earning an old
   * badge brings it back to the front of the rafters.
   */
  lastEarnedOn: string | null
}

/** One exercise's (or the pooled ladder's) tiers, with its own tally. */
export interface AchievementGroup {
  /** Exercise name, or `null` for the pooled "all movements" ladder. */
  exercise: string | null
  /** Display heading — the exercise name, or {@link POOLED_LABEL}. */
  label: string
  /** Accent from the matching {@link ExerciseGoal.color}, or `null` when unknown. */
  color: string | null
  /**
   * Implements moved per set, from the matching
   * {@link ExerciseGoal.load_multiplier}. `1` for the pooled group and for any
   * single-implement movement. The Trophy Room surfaces anything above `1` in
   * the group header, so a 120 lb shrug tier reads as two 60s rather than
   * looking like a typo.
   */
  loadMultiplier: number
  /** Tiers in this group, ordered by {@link SCOPE_ORDER} then ascending threshold. */
  achievements: ResolvedAchievement[]
  /** How many of {@link achievements} are earned. */
  earnedCount: number
}

/** The Trophy Room's full display model. */
export interface TrophyRoomView {
  /** Pooled ladder first (if configured), then one group per exercise, alphabetical. */
  groups: AchievementGroup[]
  /** Total earned across every group. */
  earnedCount: number
  /** Total tiers configured. */
  totalCount: number
  /**
   * Earned tiers, most recently earned first — the "trophy case" strip.
   * Tiers with no resolvable earn date sort last.
   */
  recent: ResolvedAchievement[]
  /**
   * Unearned tiers closest to being earned, nearest first — the "chase" strip.
   * Excludes tiers with zero progress so an untouched exercise's whole ladder
   * doesn't crowd out a badge that's genuinely close.
   */
  nextUp: ResolvedAchievement[]
}

/** Increment a `key → number` tally, treating a missing key as `0`. */
function bump(map: Map<string, number>, key: string, by: number): void {
  map.set(key, (map.get(key) ?? 0) + by)
}

/** An empty metrics bundle — the shape a tier for an exercise with no sets resolves against. */
function emptyMetrics(): MovementMetrics {
  return {
    byDay: new Map(),
    byWeek: new Map(),
    byMonth: new Map(),
    tonnageByDay: new Map(),
    tonnageByWeek: new Map(),
    tonnageByMonth: new Map(),
    sets: [],
    hitDays: [],
  }
}

/**
 * Build per-exercise (and pooled) metrics from the full set log in a single
 * pass, so N tiers over M sets stays O(M + N) rather than re-walking the log
 * per tier.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param goals Configured exercises — supplies each effective-dated daily
 *   target, which is what makes a day count toward a `'streak'`, and each
 *   `load_multiplier`, which converts a per-implement `weight_lbs` into the
 *   effective load. An exercise with no goal still gets volume metrics (at
 *   multiplier 1); its streak is simply always `0` (there's no bar to clear).
 *   Non-positive targets are treated the same way.
 *
 *   Each day is tested against the target in effect *that day* (#362).
 *   Because badges are recomputed from the full log on every render, reading
 *   the current target here would un-light earned streak badges the moment a
 *   goal was raised — the exact retroactive rewrite this module's "earned
 *   state is never stored" design otherwise avoids.
 */
function buildMetrics(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
): Map<string | null, MovementMetrics> {
  // Implements moved per set, per exercise. An exercise with no configured
  // goal — or one predating the column — falls back to a single implement,
  // which is the only safe default: it can understate a pair, but it can
  // never invent load that isn't there.
  const multiplierByExercise = new Map(
    goals.map((g) => [g.exercise, Math.max(1, g.load_multiplier ?? 1)]),
  )
  // Keyed by exercise name, with `null` — a perfectly good `Map` key — standing
  // for the pooled "all movements" ladder. Deliberately not a string sentinel:
  // any non-empty string is a valid exercise name, so a sentinel could collide
  // with a real movement rather than staying distinct from every one of them.
  const metrics = new Map<string | null, MovementMetrics>()
  const pooled = emptyMetrics()
  metrics.set(null, pooled)

  const forExercise = (exercise: string): MovementMetrics => {
    let m = metrics.get(exercise)
    if (!m) {
      m = emptyMetrics()
      metrics.set(exercise, m)
    }
    return m
  }

  // Sets arrive oldest-first from the data layer, but sort defensively: the
  // `'set'` and `'lifetime'` earn dates both depend on chronological order.
  const ordered = [...sets]
    .map((s) => ({ set: s, day: safePacificDayKey(s.logged_at) }))
    .filter((entry) => entry.day !== '')
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))

  for (const { set, day } of ordered) {
    const week = mondayOfDayKey(day)
    const month = day.slice(0, 7)
    // Effective load: what's actually being moved, not what's stamped on one
    // dumbbell. Bodyweight sets carry no `weight_lbs` and contribute 0.
    const load = (set.weight_lbs ?? 0) * (multiplierByExercise.get(set.exercise) ?? 1)
    const tonnage = set.reps * load
    const observation = { day, reps: set.reps, load, tonnage }
    for (const m of [forExercise(set.exercise), pooled]) {
      bump(m.byDay, day, set.reps)
      bump(m.byWeek, week, set.reps)
      bump(m.byMonth, month, set.reps)
      bump(m.tonnageByDay, day, tonnage)
      bump(m.tonnageByWeek, week, tonnage)
      bump(m.tonnageByMonth, month, tonnage)
      // A pooled *set* is still one exercise's set — the pooled `'set'` ladder
      // asks "biggest single set of anything", not "reps across a day's sets".
      m.sets.push(observation)
    }
  }

  // Goal-hit days, per exercise and pooled. A pooled hit day is any day where
  // at least one exercise cleared its own target — the "did I show up?" streak.
  const pooledHits = new Set<string>()
  for (const goal of goals) {
    const m = metrics.get(goal.exercise)
    if (!m || goal.daily_target <= 0) continue
    // Per-day bar (#362), bound once per goal rather than per logged day.
    const targetFor = targetResolverFor(goal)
    for (const [day, reps] of m.byDay) {
      if (reps < targetFor(day)) continue
      m.hitDays.push(day)
      pooledHits.add(day)
    }
    m.hitDays.sort()
  }
  pooled.hitDays = [...pooledHits].sort()

  return metrics
}

/**
 * The per-scope resolution result, before it's paired back with its tier.
 *
 * @property best     Biggest value ever recorded against the metric.
 * @property earnedOn Every bucket that cleared the threshold, chronological —
 *   the raw material for `timesEarned` / `firstEarnedOn` / `lastEarnedOn`.
 */
interface MetricOutcome {
  best: number
  earnedOn: string[]
}

/**
 * Resolve a bucketed volume metric (`'day'` / `'week'` / `'month'`): the
 * biggest bucket, and every bucket that cleared the threshold. Repeatable —
 * a second 100-rep day earns the Century Club a second time.
 *
 * The keys are sorted rather than taken in `Map` insertion order: buckets are
 * filled in set order, which is chronological today, but sorting makes
 * "first" and "last" correct regardless of how the map was populated.
 */
function resolveBuckets(buckets: ReadonlyMap<string, number>, threshold: number): MetricOutcome {
  let best = 0
  const earnedOn: string[] = []
  for (const [key, value] of buckets) {
    if (value > best) best = value
    if (value >= threshold) earnedOn.push(key)
  }
  earnedOn.sort()
  return { best, earnedOn }
}

/**
 * Resolve the `'lifetime'` scope: the all-time running total of `daily`, and
 * the day it first crossed the threshold.
 *
 * The one non-repeatable scope — a cumulative total only goes up, so it's
 * crossed exactly once and `earnedOn` holds at most one day.
 *
 * @param daily Per-day totals — reps or tonnage, depending on the measure.
 */
function resolveLifetime(daily: ReadonlyMap<string, number>, threshold: number): MetricOutcome {
  const days = [...daily.keys()].sort()
  let running = 0
  let crossedOn: string | null = null
  for (const day of days) {
    running += daily.get(day) ?? 0
    if (crossedOn === null && running >= threshold) crossedOn = day
  }
  return { best: running, earnedOn: crossedOn === null ? [] : [crossedOn] }
}

/**
 * Resolve the `'set'` scope: the biggest single set by `pick`, and the day of
 * every set that cleared the threshold. Repeatable per *set*, not per day — two
 * 20-rep sets in one session earn a 20-rep tier twice, so the same day key can
 * appear more than once.
 *
 * `metrics.sets` is already chronological (see {@link buildMetrics}), so the
 * result needs no sort.
 *
 * @param pick Which per-set value the threshold applies to: reps, effective
 *   load, or the set's tonnage.
 */
function resolveSets(
  metrics: MovementMetrics,
  threshold: number,
  pick: (set: MovementMetrics['sets'][number]) => number,
): MetricOutcome {
  let best = 0
  const earnedOn: string[] = []
  for (const observation of metrics.sets) {
    const value = pick(observation)
    if (value > best) best = value
    // A bodyweight set has 0 load and 0 tonnage; it must never earn a load or
    // tonnage tier, which a `>= threshold` test would allow only if a tier
    // somehow had a non-positive threshold. Guard it explicitly.
    if (value > 0 && value >= threshold) earnedOn.push(observation.day)
  }
  return { best, earnedOn }
}

/**
 * Resolve the `'streak'` scope: the longest run of consecutive goal-hit days,
 * and the day each qualifying run reached the threshold.
 *
 * A run counts once, on the day it *reaches* the threshold — a 20-day run earns
 * the 7-day badge one time, not fourteen — but a *later* run earns it again, so
 * the badge is repeatable across separate streaks.
 */
function resolveStreak(metrics: MovementMetrics, threshold: number): MetricOutcome {
  let best = 0
  let run = 0
  const earnedOn: string[] = []
  let previous: string | null = null

  for (const day of metrics.hitDays) {
    run = previous !== null && shiftDayKey(previous, 1) === day ? run + 1 : 1
    previous = day
    if (run > best) best = run
    if (run === threshold) earnedOn.push(day)
  }

  return { best, earnedOn }
}

/**
 * Dispatch one tier to the resolver for its scope × measure.
 *
 * `'streak'` is measure-agnostic: a day counts toward a streak when it hits the
 * exercise's `daily_target`, which is a rep target, so a tonnage or load streak
 * would have no bar to clear. Such a tier resolves as a plain rep streak rather
 * than silently reporting zero.
 *
 * `'load'` over a windowed scope means "heaviest single set in that window", so
 * its `best` matches the all-time top set. That combination is allowed but
 * rarely more useful than `scope: 'set'`.
 */
function resolveMetric(metrics: MovementMetrics, achievement: WeightRoomAchievement): MetricOutcome {
  const { threshold } = achievement
  const measure: AchievementMeasure = achievement.measure ?? 'reps'

  if (achievement.scope === 'streak') {
    return resolveStreak(metrics, threshold)
  }

  if (achievement.scope === 'set') {
    const pick =
      measure === 'tonnage'
        ? (s: MovementMetrics['sets'][number]) => s.tonnage
        : measure === 'load'
          ? (s: MovementMetrics['sets'][number]) => s.load
          : (s: MovementMetrics['sets'][number]) => s.reps
    return resolveSets(metrics, threshold, pick)
  }

  // A windowed `'load'` tier asks for the heaviest set inside the window, which
  // isn't a sum — resolve it off the per-set observations rather than a bucket.
  if (measure === 'load') {
    return resolveSets(metrics, threshold, (s) => s.load)
  }

  const isTonnage = measure === 'tonnage'
  switch (achievement.scope) {
    case 'day':
      return resolveBuckets(isTonnage ? metrics.tonnageByDay : metrics.byDay, threshold)
    case 'week':
      return resolveBuckets(isTonnage ? metrics.tonnageByWeek : metrics.byWeek, threshold)
    case 'month':
      return resolveBuckets(isTonnage ? metrics.tonnageByMonth : metrics.byMonth, threshold)
    case 'lifetime':
      return resolveLifetime(isTonnage ? metrics.tonnageByDay : metrics.byDay, threshold)
  }
}

/**
 * Resolve every tier on the ladder against the log.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param goals Configured exercises; supplies each `daily_target` (the bar a
 *   `'streak'` day must clear) and the accent color used by
 *   {@link buildTrophyRoomView}.
 * @param achievements The ladder from `weight_room_achievements`; may be empty.
 * @returns One {@link ResolvedAchievement} per tier, in the order supplied.
 */
export function resolveAchievements(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  achievements: readonly WeightRoomAchievement[],
): ResolvedAchievement[] {
  const metrics = buildMetrics(sets, goals)

  return achievements.map((achievement) => {
    const outcome = resolveMetric(
      metrics.get(achievement.exercise) ?? emptyMetrics(),
      achievement,
    )
    // Guard the divisor: the DB CHECK enforces `threshold > 0`, but a tier
    // slipping through with 0 would make `progress` Infinity/NaN.
    const threshold = Math.max(1, achievement.threshold)
    const { earnedOn } = outcome
    return {
      achievement,
      earned: earnedOn.length > 0,
      best: outcome.best,
      progress: Math.max(0, Math.min(1, outcome.best / threshold)),
      remaining: Math.max(0, threshold - outcome.best),
      earnedOn,
      timesEarned: earnedOn.length,
      firstEarnedOn: earnedOn[0] ?? null,
      lastEarnedOn: earnedOn[earnedOn.length - 1] ?? null,
    }
  })
}

/** How many entries the `recent` / `nextUp` strips carry. */
const STRIP_SIZE = 6

/**
 * Build the Trophy Room's full display model: tiers resolved, grouped by
 * exercise, plus the "recently earned" and "closest to earning" strips.
 *
 * Groups are ordered with the pooled "all movements" ladder first (it's the
 * headline — it spans everything), then one group per exercise alphabetically.
 * Within a group, tiers sort by {@link SCOPE_ORDER} then ascending threshold,
 * so each scope reads as a ladder.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param goals Configured exercises; supplies streak targets and group accents.
 * @param achievements The ladder from `weight_room_achievements`; may be empty
 *   (yields an empty view, which the page renders as its empty state).
 * @param exercises The movement roster, for display labels (#384). Tiers are
 *   deliberately not FK'd to goals — deleting a goal keeps its badges — so the
 *   label has to come from the catalog, not from `goals`, or a movement with
 *   tiers and no goal renders its raw slug.
 */
export function buildTrophyRoomView(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  achievements: readonly WeightRoomAchievement[],
  exercises: readonly WeightRoomExercise[] = [],
): TrophyRoomView {
  const colorByExercise = new Map(goals.map((g) => [g.exercise, g.color]))
  // Catalog first, goal-joined label second (#384). Achievements outlive their
  // goal, so a goals-only lookup would drop back to the slug for exactly the
  // movements whose badges were deliberately preserved.
  const labelByExercise = new Map<string, string>()
  for (const g of goals) {
    if (g.display_name !== undefined) labelByExercise.set(g.exercise, g.display_name)
  }
  for (const e of exercises) labelByExercise.set(e.slug, e.display_name)
  const multiplierByExercise = new Map(
    goals.map((g) => [g.exercise, Math.max(1, g.load_multiplier ?? 1)]),
  )

  // Attached once here rather than inside `resolveAchievements` so the groups
  // and both strips read the same label off the same objects.
  const resolved = resolveAchievements(sets, goals, achievements).map((entry) => {
    const slug = entry.achievement.exercise
    const label = slug === null || slug === undefined ? undefined : labelByExercise.get(slug)
    return label === undefined ? entry : { ...entry, displayName: label }
  })

  const byExercise = new Map<string | null, ResolvedAchievement[]>()
  for (const entry of resolved) {
    const key = entry.achievement.exercise
    const bucket = byExercise.get(key)
    if (bucket) bucket.push(entry)
    else byExercise.set(key, [entry])
  }

  const groups: AchievementGroup[] = [...byExercise.entries()]
    .sort(([a], [b]) => {
      // Pooled ladder first, then alphabetical by exercise.
      if (a === null) return -1
      if (b === null) return 1
      return a.localeCompare(b)
    })
    .map(([key, entries]) => {
      const isPooled = key === null
      entries.sort((a, b) => {
        const scopeDelta =
          SCOPE_ORDER.indexOf(a.achievement.scope) - SCOPE_ORDER.indexOf(b.achievement.scope)
        if (scopeDelta !== 0) return scopeDelta
        // Then by measure, so a scope's rep tiers stay together and its
        // tonnage/load tiers form their own runs — the subsections the Trophy
        // Room renders are built by walking this order.
        const measureDelta =
          MEASURE_ORDER.indexOf(a.achievement.measure ?? 'reps') -
          MEASURE_ORDER.indexOf(b.achievement.measure ?? 'reps')
        return measureDelta !== 0
          ? measureDelta
          : a.achievement.threshold - b.achievement.threshold
      })
      return {
        exercise: isPooled ? null : key,
        label: isPooled ? POOLED_LABEL : (labelByExercise.get(key) ?? key),
        color: isPooled ? null : (colorByExercise.get(key) ?? null),
        // The pooled ladder spans movements with different multipliers, so it
        // has no single one of its own — its tonnage already has each set's
        // multiplier baked in.
        loadMultiplier: isPooled ? 1 : (multiplierByExercise.get(key) ?? 1),
        achievements: entries,
        earnedCount: entries.filter((e) => e.earned).length,
      }
    })

  const recent = resolved
    .filter((e) => e.earned)
    // Ordered by the *most recent* earn, not the first, so re-earning an old
    // badge brings it back to the front of the rafters — the strip reads as
    // "what I just did", not "what I did once, months ago".
    //
    // A `null` earn date (shouldn't happen for an earned tier, but the types
    // allow it) sorts to the end rather than to the top.
    //
    // Keys are compared as strings across mixed granularity: a `'month'` tier's
    // `YYYY-MM` is a prefix of any day key in that month, so it sorts just
    // before same-month day tiers. That's the honest ordering — "earned in
    // July" genuinely can't be placed against "earned July 14".
    .sort((a, b) => (b.lastEarnedOn ?? '').localeCompare(a.lastEarnedOn ?? ''))
    .slice(0, STRIP_SIZE)

  const nextUp = resolved
    .filter((e) => !e.earned && e.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, STRIP_SIZE)

  return {
    groups,
    earnedCount: resolved.filter((e) => e.earned).length,
    totalCount: resolved.length,
    recent,
    nextUp,
  }
}

/**
 * Human phrasing of what a tier asks for, e.g. `"100 reps in a day"`,
 * `"30-day streak"`, `"20 reps in one set"`. Used as the badge's subtitle so a
 * label like "Century Club" is never ambiguous about which metric it measures.
 */
export function describeAchievement(achievement: WeightRoomAchievement): string {
  const n = achievement.threshold.toLocaleString('en-US')
  const measure: AchievementMeasure = achievement.measure ?? 'reps'

  // A streak always counts days against the rep target, whatever the measure.
  if (achievement.scope === 'streak') return `${n}-day streak`

  // Load is a property of one set no matter the window it's scoped to.
  if (measure === 'load') return `${n} lb on one set`

  const noun = measure === 'tonnage' ? 'lb' : 'reps'
  switch (achievement.scope) {
    case 'day':
      return `${n} ${noun} in a day`
    case 'week':
      return `${n} ${noun} in a week`
    case 'month':
      return `${n} ${noun} in a month`
    case 'lifetime':
      return `${n} ${noun} all-time`
    case 'set':
      return `${n} ${noun} in one set`
  }
}

/**
 * Unit label for a tier's threshold and `best` — `days` for a streak, `lb` for
 * a load or tonnage tier, `reps` otherwise. Used for the "N to go" copy.
 */
export function achievementUnit(achievement: WeightRoomAchievement): string {
  if (achievement.scope === 'streak') return 'days'
  return achievement.measure === 'tonnage' || achievement.measure === 'load' ? 'lb' : 'reps'
}

/** The emoji shown on a badge face — the tier's own `icon`, else a scope default. */
export function achievementIcon(achievement: WeightRoomAchievement): string {
  return achievement.icon ?? SCOPE_ICONS[achievement.scope]
}

/**
 * Format a {@link ResolvedAchievement.firstEarnedOn} bucket key for display.
 * A `'month'` tier's key is `YYYY-MM` and renders as `"Jul 2026"`; every other
 * scope's key is a day and renders as `"Jul 14, 2026"`.
 *
 * Parsed at local noon so the viewer's UTC offset can't shift the label back a
 * day, matching the rest of the Weight Room's date handling.
 *
 * @returns The formatted date, or `''` when `bucketKey` is `null`/unparseable —
 *   so callers can use falsiness to skip the "earned" line entirely.
 */
export function formatEarnedOn(bucketKey: string | null, scope: AchievementScope): string {
  if (bucketKey === null) return ''
  const isMonth = scope === 'month'
  const d = new Date((isMonth ? `${bucketKey}-01` : bucketKey) + 'T12:00:00')
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString(
    undefined,
    isMonth
      ? { month: 'short', year: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  )
}
