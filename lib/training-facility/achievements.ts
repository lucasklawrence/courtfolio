import type {
  AchievementScope,
  ExerciseGoal,
  StrengthSet,
  WeightRoomAchievement,
} from '@/types/weight-room'

import { toLocalDateKey } from './strength-today'

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
 * All bucketing uses *local* calendar days via {@link toLocalDateKey}, and ISO
 * (Mon–Sun) weeks, matching the History view's heatmap rows and weekly-volume
 * chart so a badge can never disagree with a bar the user is looking at.
 */

/** Map key standing in for the pooled "all movements" ladder (`exercise: null`). */
const POOLED_KEY = '*'

/** Render order for scopes — volume ladders first, then the "how" scopes. */
const SCOPE_ORDER: readonly AchievementScope[] = [
  'day',
  'week',
  'month',
  'streak',
  'lifetime',
  'set',
]

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
  /** Every set as `{ day, reps }`, in chronological order — the `'set'` scope's source. */
  sets: { day: string; reps: number }[]
  /**
   * Day keys that met the daily target, ascending — the `'streak'` scope's
   * source. For a single exercise that's `reps >= its goal.daily_target`; for
   * the pooled ladder it's any day where *at least one* exercise hit its own
   * target.
   */
  hitDays: string[]
}

/** One ladder tier resolved against the log. */
export interface ResolvedAchievement {
  /** The tier being resolved. */
  achievement: WeightRoomAchievement
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
   * How many times the tier has been earned — qualifying days / weeks /
   * months / sets, or distinct streak runs that reached the threshold.
   * `'lifetime'` is `1` or `0` (a cumulative total is crossed once).
   */
  timesEarned: number
  /**
   * Bucket key of the first time it was earned, or `null` if never. A day key
   * (`YYYY-MM-DD`) for every scope except `'month'`, which is `YYYY-MM`. Format
   * it with {@link formatEarnedOn}.
   */
  firstEarnedOn: string | null
}

/** One exercise's (or the pooled ladder's) tiers, with its own tally. */
export interface AchievementGroup {
  /** Exercise name, or `null` for the pooled "all movements" ladder. */
  exercise: string | null
  /** Display heading — the exercise name, or {@link POOLED_LABEL}. */
  label: string
  /** Accent from the matching {@link ExerciseGoal.color}, or `null` when unknown. */
  color: string | null
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

/** ISO-week (Monday) key for a `YYYY-MM-DD` day key. Local noon so DST can't shift the day. */
function weekKeyOf(dayKey: string): string {
  const d = new Date(dayKey + 'T12:00:00')
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return toLocalDateKey(d)
}

/** Add `n` days to a `YYYY-MM-DD` key. Local-noon base so DST can't shift the day. */
function addDays(dayKey: string, n: number): string {
  const d = new Date(dayKey + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toLocalDateKey(d)
}

/** Increment a `key → number` tally, treating a missing key as `0`. */
function bump(map: Map<string, number>, key: string, by: number): void {
  map.set(key, (map.get(key) ?? 0) + by)
}

/** An empty metrics bundle — the shape a tier for an exercise with no sets resolves against. */
function emptyMetrics(): MovementMetrics {
  return { byDay: new Map(), byWeek: new Map(), byMonth: new Map(), sets: [], hitDays: [] }
}

/**
 * Build per-exercise (and pooled) metrics from the full set log in a single
 * pass, so N tiers over M sets stays O(M + N) rather than re-walking the log
 * per tier.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param goals Configured exercises — supplies each `daily_target`, which is
 *   what makes a day count toward a `'streak'`. An exercise with no goal still
 *   gets volume metrics; its streak is simply always `0` (there's no bar to
 *   clear). Non-positive targets are treated the same way.
 */
function buildMetrics(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
): Map<string, MovementMetrics> {
  const metrics = new Map<string, MovementMetrics>()
  const pooled = emptyMetrics()
  metrics.set(POOLED_KEY, pooled)

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
    .map((s) => ({ set: s, day: toLocalDateKey(s.logged_at) }))
    .filter((entry) => entry.day !== '')
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))

  for (const { set, day } of ordered) {
    const week = weekKeyOf(day)
    const month = day.slice(0, 7)
    const observation = { day, reps: set.reps }
    for (const m of [forExercise(set.exercise), pooled]) {
      bump(m.byDay, day, set.reps)
      bump(m.byWeek, week, set.reps)
      bump(m.byMonth, month, set.reps)
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
    for (const [day, reps] of m.byDay) {
      if (reps < goal.daily_target) continue
      m.hitDays.push(day)
      pooledHits.add(day)
    }
    m.hitDays.sort()
  }
  pooled.hitDays = [...pooledHits].sort()

  return metrics
}

/** The per-scope resolution result, before it's paired back with its tier. */
interface MetricOutcome {
  best: number
  timesEarned: number
  firstEarnedOn: string | null
}

/**
 * Resolve a bucketed volume metric (`'day'` / `'week'` / `'month'`): the
 * biggest bucket, how many buckets cleared the threshold, and the earliest one
 * that did.
 */
function resolveBuckets(buckets: ReadonlyMap<string, number>, threshold: number): MetricOutcome {
  let best = 0
  let timesEarned = 0
  let firstEarnedOn: string | null = null
  for (const [key, value] of buckets) {
    if (value > best) best = value
    if (value < threshold) continue
    timesEarned++
    if (firstEarnedOn === null || key < firstEarnedOn) firstEarnedOn = key
  }
  return { best, timesEarned, firstEarnedOn }
}

/**
 * Resolve the `'lifetime'` scope: the all-time rep total, and the day the
 * running total first crossed the threshold. Earned at most once — a
 * cumulative total only goes up, so it's crossed exactly one time.
 */
function resolveLifetime(metrics: MovementMetrics, threshold: number): MetricOutcome {
  const days = [...metrics.byDay.keys()].sort()
  let running = 0
  let firstEarnedOn: string | null = null
  for (const day of days) {
    running += metrics.byDay.get(day) ?? 0
    if (firstEarnedOn === null && running >= threshold) firstEarnedOn = day
  }
  return { best: running, timesEarned: firstEarnedOn === null ? 0 : 1, firstEarnedOn }
}

/**
 * Resolve the `'set'` scope: the biggest single set, how many sets cleared the
 * threshold, and the day of the first one that did.
 */
function resolveSets(metrics: MovementMetrics, threshold: number): MetricOutcome {
  let best = 0
  let timesEarned = 0
  let firstEarnedOn: string | null = null
  for (const { day, reps } of metrics.sets) {
    if (reps > best) best = reps
    if (reps < threshold) continue
    timesEarned++
    if (firstEarnedOn === null) firstEarnedOn = day
  }
  return { best, timesEarned, firstEarnedOn }
}

/**
 * Resolve the `'streak'` scope: the longest run of consecutive goal-hit days,
 * how many distinct runs reached the threshold, and the day the first such run
 * hit it.
 *
 * A run counts once, on the day it *reaches* the threshold — a 20-day run earns
 * the 7-day badge one time, not fourteen.
 */
function resolveStreak(metrics: MovementMetrics, threshold: number): MetricOutcome {
  let best = 0
  let run = 0
  let timesEarned = 0
  let firstEarnedOn: string | null = null
  let previous: string | null = null

  for (const day of metrics.hitDays) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1
    previous = day
    if (run > best) best = run
    if (run === threshold) {
      timesEarned++
      if (firstEarnedOn === null) firstEarnedOn = day
    }
  }

  return { best, timesEarned, firstEarnedOn }
}

/** Dispatch one tier to the resolver for its scope. */
function resolveMetric(metrics: MovementMetrics, achievement: WeightRoomAchievement): MetricOutcome {
  switch (achievement.scope) {
    case 'day':
      return resolveBuckets(metrics.byDay, achievement.threshold)
    case 'week':
      return resolveBuckets(metrics.byWeek, achievement.threshold)
    case 'month':
      return resolveBuckets(metrics.byMonth, achievement.threshold)
    case 'lifetime':
      return resolveLifetime(metrics, achievement.threshold)
    case 'set':
      return resolveSets(metrics, achievement.threshold)
    case 'streak':
      return resolveStreak(metrics, achievement.threshold)
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
    const key = achievement.exercise ?? POOLED_KEY
    const outcome = resolveMetric(metrics.get(key) ?? emptyMetrics(), achievement)
    // Guard the divisor: the DB CHECK enforces `threshold > 0`, but a tier
    // slipping through with 0 would make `progress` Infinity/NaN.
    const threshold = Math.max(1, achievement.threshold)
    const earned = outcome.timesEarned > 0
    return {
      achievement,
      earned,
      best: outcome.best,
      progress: Math.max(0, Math.min(1, outcome.best / threshold)),
      remaining: Math.max(0, threshold - outcome.best),
      timesEarned: outcome.timesEarned,
      firstEarnedOn: outcome.firstEarnedOn,
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
 */
export function buildTrophyRoomView(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  achievements: readonly WeightRoomAchievement[],
): TrophyRoomView {
  const resolved = resolveAchievements(sets, goals, achievements)
  const colorByExercise = new Map(goals.map((g) => [g.exercise, g.color]))

  const byExercise = new Map<string, ResolvedAchievement[]>()
  for (const entry of resolved) {
    const key = entry.achievement.exercise ?? POOLED_KEY
    const bucket = byExercise.get(key)
    if (bucket) bucket.push(entry)
    else byExercise.set(key, [entry])
  }

  const groups: AchievementGroup[] = [...byExercise.entries()]
    .sort(([a], [b]) => {
      // Pooled ladder first, then alphabetical by exercise.
      if (a === POOLED_KEY) return -1
      if (b === POOLED_KEY) return 1
      return a.localeCompare(b)
    })
    .map(([key, entries]) => {
      const isPooled = key === POOLED_KEY
      entries.sort((a, b) => {
        const scopeDelta =
          SCOPE_ORDER.indexOf(a.achievement.scope) - SCOPE_ORDER.indexOf(b.achievement.scope)
        return scopeDelta !== 0 ? scopeDelta : a.achievement.threshold - b.achievement.threshold
      })
      return {
        exercise: isPooled ? null : key,
        label: isPooled ? POOLED_LABEL : key,
        color: isPooled ? null : (colorByExercise.get(key) ?? null),
        achievements: entries,
        earnedCount: entries.filter((e) => e.earned).length,
      }
    })

  const recent = resolved
    .filter((e) => e.earned)
    // Newest first; a `null` earn date (shouldn't happen for an earned tier,
    // but the types allow it) sorts to the end rather than to the top.
    //
    // Keys are compared as strings across mixed granularity: a `'month'` tier's
    // `YYYY-MM` is a prefix of any day key in that month, so it sorts just
    // before same-month day tiers. That's the honest ordering — "earned in
    // July" genuinely can't be placed against "earned July 14".
    .sort((a, b) => (b.firstEarnedOn ?? '').localeCompare(a.firstEarnedOn ?? ''))
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
  switch (achievement.scope) {
    case 'day':
      return `${n} reps in a day`
    case 'week':
      return `${n} reps in a week`
    case 'month':
      return `${n} reps in a month`
    case 'streak':
      return `${n}-day streak`
    case 'lifetime':
      return `${n} reps all-time`
    case 'set':
      return `${n} reps in one set`
  }
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
