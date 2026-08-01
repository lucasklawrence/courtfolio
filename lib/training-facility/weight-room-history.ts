import type { ExerciseGoal, MonthlyFocus, StrengthSet } from '@/types/weight-room'

import {
  dayKeyToPacificNoon,
  firstDayOfMonth,
  inclusiveDaySpan,
  lastDayOfMonth,
  mondayOfDayKey,
  monthIndexOfDayKey,
  pacificDayKey,
  safePacificDayKey,
  shiftDayKey,
} from './day-keys'
import {
  type GoalTargetChange,
  goalTargetChanges,
  targetForDay,
  targetResolverFor,
} from './goal-targets'
import { type StreakCounts, streakFromDailyReps } from './hit-day-streaks'
import {
  type FocusCampaignSummary,
  focusTargetHistory,
  summarizeFocusCampaigns,
} from './monthly-focus'

/**
 * Pure helpers for the Weight Room History View (#81). Mirrors the
 * cardio-side `heatmap-grid.ts` + `streaks.ts` split: this module owns
 * the per-exercise daily aggregation, the goal-relative intensity
 * bucketing, the streak rule (consecutive days hitting the daily goal),
 * and the period rollups (week / month / all-time) that the stats
 * panel reads.
 *
 * Strength sets carry an ISO `logged_at` timestamp; heatmap and stats
 * both bucket by *local* calendar day so a set logged at 11pm doesn't
 * silently roll into the next day.
 *
 * Every goal-relative number here resolves the target **per day** via
 * {@link targetResolverFor} rather than reading `goal.daily_target` (#362).
 * Dividing the whole history by the current target meant raising a goal
 * retroactively re-scored days already completed — closed rings re-opened,
 * streaks collapsed, full-intensity cells dropped to half.
 */

/** A single cell in the strength heatmap grid for one exercise. */
export interface StrengthHeatmapCell {
  /**
   * The day this cell represents, positioned at **noon Pacific** (#319) so a
   * renderer calling `toLocaleDateString` can't display the adjacent day.
   * Prefer {@link dayKey} for comparisons; this is for formatting.
   */
  date: Date
  /**
   * `YYYY-MM-DD` Pacific key for this cell — the canonical identity, and what
   * every window/boundary comparison should use. Saves callers re-deriving a
   * key from {@link date} and getting a different timezone's answer.
   */
  dayKey: string
  /** Sum of reps logged for this exercise on {@link date}. `0` for empty days. */
  reps: number
  /** Number of distinct sets logged on {@link date}. */
  setCount: number
  /**
   * `reps / dailyTarget` — un-clamped, so 100% means "exactly hit the
   * goal" and 1.5 means "150% of goal". Empty days are `0`.
   *
   * The denominator is the target that was in effect on {@link date}, not
   * the goal's current target (#362), so a cell keeps the intensity it
   * earned when the goal later moves.
   */
  pct: number
  /**
   * The daily target in effect on {@link date} — the denominator behind
   * {@link pct}. Surfaced so a tooltip can say "32 of 30" using the bar that
   * actually applied rather than today's.
   */
  dailyTarget: number
}

/** Result of {@link buildStrengthHeatmap}. */
export interface StrengthHeatmapGrid {
  /** 7-row × N-column grid; row 0 is Monday, row 6 is Sunday. */
  grid: StrengthHeatmapCell[][]
  /** First-of-month markers for the column header labels. */
  monthLabels: { col: number; label: string }[]
}

/**
 * One week's rep total for a single exercise — the datum behind a bar
 * in the History view's weekly-volume chart (#216 follow-up). Buckets
 * are ISO weeks (Mon–Sun), matching the heatmap's row layout and the
 * stats panel's `thisWeek`/`lastWeek` rollups.
 */
export interface WeeklyVolumePoint {
  /** Monday (00:00 local) that opens this ISO week. */
  weekStart: Date
  /** `YYYY-MM-DD` of {@link weekStart} — a stable, unique band key. */
  weekKey: string
  /** Short `M/D` x-axis label derived from {@link weekStart}. */
  label: string
  /** Total reps logged for this exercise across the week. `0` for empty weeks. */
  reps: number
  /** Number of distinct sets logged across the week. */
  setCount: number
}

/** Per-exercise rollups for the stats panel. */
export interface StrengthExerciseStats {
  /** Exercise name (matches {@link ExerciseGoal.exercise}). */
  exercise: string
  /**
   * Human label for {@link exercise}, carried through from the goal's
   * catalog-joined {@link ExerciseGoal.display_name} (#384). Absent falls back
   * to the slug at the render site.
   */
  displayName?: string
  /** Hex color from the matching {@link ExerciseGoal.color}. */
  color: string
  /**
   * The daily target in effect today — what the panel labels the exercise
   * with. For a focus-anchored exercise this is the *rotation's* target, not
   * the anchor goal's scalar (#367): labelling a shrugs card "goal 500/day"
   * beside a streak that counts 100-rep days as hits is a straight
   * contradiction.
   *
   * Historical rollups on this same object (the streaks) resolve their own
   * per-day targets and do NOT divide by this (#362); read
   * {@link targetChanges} for where the bar moved.
   */
  dailyTarget: number
  /**
   * Consecutive days (ending today or yesterday) hitting the daily target,
   * each day tested against the target in effect that day.
   */
  currentStreak: number
  /**
   * Longest run of consecutive days hitting the daily target, all-time, each
   * day tested against the target in effect that day.
   */
  longestStreak: number
  /** Total reps logged this ISO week (Mon–Sun, current). */
  thisWeekReps: number
  /** Total reps logged last ISO week (Mon–Sun, previous). */
  lastWeekReps: number
  /** Total reps logged in the current calendar month. */
  thisMonthReps: number
  /** Total reps logged in the previous calendar month. */
  lastMonthReps: number
  /**
   * Mean sets per *active* day (a day with at least one set) over the
   * whole logged history. `0` when no sets exist for this exercise.
   * Active-day denominator (rather than calendar days since first set)
   * answers "when I train, how many sets do I do" — the question the
   * Today View's quick-log most directly relates to.
   */
  avgSetsPerActiveDay: number
  /** All-time total reps for this exercise. */
  allTimeReps: number
  /**
   * Every point at which this goal's target moved, oldest first (#362) —
   * empty for a goal that has never been edited. The stats panel renders
   * these as "30 → 50 on Aug 1" so a step in adherence is explained rather
   * than mysterious.
   */
  targetChanges: GoalTargetChange[]
  /**
   * Campaign rollup when this exercise is a "grease the groove" focus (#367),
   * aggregated across every rotation it has run. Absent for permanent goals
   * and for focus anchors with no window configured yet.
   *
   * The stats card uses {@link FocusCampaignSummary.isActive} to decide which
   * cells to show: a live campaign keeps the week/month rollups, a closed one
   * swaps them for campaign-scoped numbers, since "0 reps this week" is a true
   * but useless reading of a rotation that ended in July.
   */
  focus?: FocusCampaignSummary
}

/** Cap at ~2 years to limit DOM node count when a wide range is requested. */
const MAX_COLS = 104
/** Days in a calendar week — heatmap column height, and the week-key stride. */
const DAYS_PER_WEEK = 7

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Bucket reps-as-percent-of-goal into one of four intensity levels for
 * the heatmap cell color: 0 = empty, 1 = light (1–49%), 2 = medium
 * (50–99%), 3 = full (100%+). Matches the four-band scheme called out
 * in the issue body.
 */
export function intensityFromPct(pct: number): 0 | 1 | 2 | 3 {
  if (pct <= 0) return 0
  if (pct < 0.5) return 1
  if (pct < 1) return 2
  return 3
}

/**
 * Aggregate one exercise's sets into a 7-row × N-column heatmap. Row 0
 * is Monday so a year reads top-down as Mon→Sun. The grid spans the
 * supplied range when both `dateFrom` and `dateTo` are provided;
 * otherwise it falls back to the trailing 52 weeks ending at the
 * current week. Capped at ~2 years to keep the DOM small.
 *
 * Each cell carries the day's rep total, set count, and `pct = reps /
 * dailyTarget` so the renderer can pick a color via
 * {@link intensityFromPct} and a tooltip can read "32 reps (3 sets,
 * 32% of goal)". The denominator is resolved per cell from the goal's
 * effective-dated history (#362), so cells on either side of a goal change
 * are each scored against the bar that was live that day.
 *
 * Sets whose `exercise` doesn't match `goal.exercise` are silently
 * ignored — call once per exercise.
 *
 * @param sets every logged set from {@link import('@/types/weight-room').WeightRoomData.sets};
 *   the helper filters to the matching exercise.
 * @param goal the {@link ExerciseGoal} for the target exercise; supplies
 *   the per-day `daily_target` denominator for `pct` via its
 *   `target_history` (falling back to `daily_target` when absent).
 * @param dateFrom optional inclusive start of the range; clamped to ~2
 *   years before `dateTo` if longer.
 * @param dateTo optional inclusive end; defaults to today.
 */
export function buildStrengthHeatmap(
  sets: readonly StrengthSet[],
  goal: ExerciseGoal,
  dateFrom?: Date | null,
  dateTo?: Date | null
): StrengthHeatmapGrid {
  // Column boundaries walk day keys, not milliseconds (#319): a DST week is
  // 23 or 25 hours long, so `+ 7 * DAY_MS` drifts off the Monday twice a year.
  //
  // Both bounds go through `safePacificDayKey` because they arrive as props
  // from user-derived state: `pacificDayKey` throws `RangeError` on an Invalid
  // Date, which would take the whole page down rather than degrading. An
  // unusable bound falls back to the same default as omitting it.
  const endKey = safePacificDayKey(dateTo ?? new Date())
  const endMondayKey = mondayOfDayKey(endKey === '' ? pacificDayKey(new Date()) : endKey)

  const startKey = dateFrom ? safePacificDayKey(dateFrom) : ''
  let startMondayKey: string
  if (startKey !== '') {
    startMondayKey = mondayOfDayKey(startKey)
    const maxStartKey = shiftDayKey(endMondayKey, -MAX_COLS * DAYS_PER_WEEK)
    if (startMondayKey < maxStartKey) startMondayKey = maxStartKey
  } else {
    startMondayKey = shiftDayKey(endMondayKey, -52 * DAYS_PER_WEEK)
  }

  // Lookup: Pacific day key → { reps, setCount } for the matching exercise.
  // Read-modify-write the same shape regardless of hit/miss so the
  // accumulation reads symmetrically; the trailing `lookup.set` is a
  // no-op on a hit because we mutate the same object reference.
  const lookup = new Map<string, { reps: number; setCount: number }>()
  for (const s of sets) {
    if (s.exercise !== goal.exercise) continue
    const key = safePacificDayKey(s.logged_at)
    if (key === '') continue
    const entry = lookup.get(key) ?? { reps: 0, setCount: 0 }
    entry.reps += s.reps
    entry.setCount += 1
    lookup.set(key, entry)
  }

  // Per-day target resolution (#362). Bound once so the history is sorted
  // a single time rather than per cell; the resolver also owns the
  // non-positive clamp that used to live here inline.
  const targetFor = targetResolverFor(goal)
  const totalCols =
    Math.floor(
      (inclusiveDaySpan(startMondayKey, shiftDayKey(endMondayKey, 6)) - 1) / DAYS_PER_WEEK
    ) + 1
  const grid: StrengthHeatmapCell[][] = Array.from({ length: 7 }, () => [])
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1

  for (let col = 0; col < totalCols; col++) {
    for (let row = 0; row < 7; row++) {
      const key = shiftDayKey(startMondayKey, col * DAYS_PER_WEEK + row)
      const entry = lookup.get(key)
      const reps = entry?.reps ?? 0
      const dailyTarget = targetFor(key)
      // Pacific noon, so a renderer calling `toLocaleDateString` shows the
      // day the cell actually represents rather than the one before it.
      const date = dayKeyToPacificNoon(key) ?? new Date(NaN)
      grid[row].push({
        date,
        dayKey: key,
        reps,
        setCount: entry?.setCount ?? 0,
        pct: reps / dailyTarget,
        dailyTarget,
      })

      const month = monthIndexOfDayKey(key)
      if (month !== lastMonth) {
        lastMonth = month
        monthLabels.push({ col, label: MONTH_LABELS[month] })
      }
    }
  }

  return { grid, monthLabels }
}

/**
 * Compute the "hit-the-goal" streak for one exercise: consecutive
 * calendar days where the exercise's daily rep total met or exceeded
 * its `daily_target`. Days below the target — even ones with reps
 * logged — break the streak. Mirrors the issue body: "consecutive days
 * hitting goal".
 *
 * `current` counts back from today (or yesterday, if today hasn't
 * crossed the target yet) and is `0` when the most recent goal-hit day
 * is older than yesterday. `longest` is the all-time best.
 *
 * Each day is tested against the target that was in effect *that day*
 * (#362), so a streak spanning a goal change is neither falsely broken (old
 * days re-tested against a raised bar) nor falsely continued (old days
 * credited against a lowered one).
 *
 * @param sets every logged set; filtered to `goal.exercise` internally.
 * @param goal the {@link ExerciseGoal} whose effective-dated target defines
 *   the bar to clear on each day.
 * @param now optional override for the "today" anchor used to decide
 *   whether `current` includes the most recent hit-day. Defaults to
 *   `new Date()`. Threaded through from {@link computeStrengthStats}
 *   so a single fixed clock drives every rollup in one stats payload.
 */
export function computeStrengthStreaks(
  sets: readonly StrengthSet[],
  goal: ExerciseGoal,
  now: Date = new Date()
): StreakCounts {
  const dailyReps = new Map<string, number>()
  for (const s of sets) {
    if (s.exercise !== goal.exercise) continue
    const key = safePacificDayKey(s.logged_at)
    if (key === '') continue
    dailyReps.set(key, (dailyReps.get(key) ?? 0) + s.reps)
  }
  return streakFromDailyReps(dailyReps, targetResolverFor(goal), pacificDayKey(now))
}

/**
 * Compute every per-exercise rollup the History stats panel needs:
 * streaks, this/last week reps, this/last month reps, average sets per
 * active day, and all-time reps. One {@link StrengthExerciseStats}
 * entry per goal, in the same order as `goals`.
 *
 * Week boundaries are ISO (Mon–Sun) so the rollup matches the heatmap's
 * row layout. Month boundaries are local calendar months. "Average
 * sets per active day" divides total sets by the number of distinct
 * days the exercise was performed — a day with multiple sets counts
 * once in the denominator.
 *
 * Implementation: a single pass over `sets` per goal fills every
 * rollup inline. The previous version did ~7 passes per goal (filter +
 * active-day loop + a separate `computeStrengthStreaks` call that
 * re-walked the array + four `sumRepsInRange` calls), which the #184
 * follow-up flagged. Same observable behavior at a tighter cost.
 *
 * @param sets every logged set across all exercises.
 * @param goals the configured exercises; one stats entry per goal.
 * @param now optional override for the "today" anchor used by the week
 *   / month / streak math. Defaults to `new Date()`. Tests pass a
 *   fixed date to make week boundaries deterministic.
 * @param focuses the configured "grease the groove" rotations (#367). Supply
 *   them to include focus-anchored exercises meaningfully: their days score
 *   against the *window's* target rather than the anchor goal's scalar, and
 *   each gets a {@link StrengthExerciseStats.focus} campaign rollup. Omitted,
 *   focus goals still produce stats — just scored against the anchor scalar,
 *   which is the pre-#367 behavior.
 */
export function computeStrengthStats(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  now: Date = new Date(),
  focuses: readonly MonthlyFocus[] = []
): StrengthExerciseStats[] {
  // Every boundary is a Pacific day key (#319), so the week and month a set
  // falls into matches the day its heatmap cell lands on. Derived by calendar
  // arithmetic rather than `Date` offsets — a DST week is 23 or 25 hours, and
  // millisecond math drifts off the Monday twice a year.
  const todayKey = pacificDayKey(now)
  const thisWeekStart = mondayOfDayKey(todayKey)
  const thisWeekEnd = shiftDayKey(thisWeekStart, 6)
  const lastWeekStart = shiftDayKey(thisWeekStart, -7)
  const lastWeekEnd = shiftDayKey(thisWeekStart, -1)

  const thisMonthStart = firstDayOfMonth(todayKey)
  const thisMonthEnd = lastDayOfMonth(todayKey)
  const lastMonthEnd = shiftDayKey(thisMonthStart, -1)
  const lastMonthStart = firstDayOfMonth(lastMonthEnd)

  return goals.map(goal => {
    // A focus anchor's real bar is its rotation's target, not the anchor's
    // scalar (#367). Synthesizing a target history from the windows routes it
    // through the same `targetForDay` every other goal uses, so two rotations
    // at different targets score correctly without a focus-only code path.
    const windowHistory = focusTargetHistory(focuses, goal.exercise)
    const scoringGoal: ExerciseGoal =
      windowHistory.length > 0 ? { ...goal, target_history: windowHistory } : goal
    const focusSummary = summarizeFocusCampaigns(focuses, goal.exercise, sets, now)

    const dailyReps = new Map<string, number>()
    let allTimeReps = 0
    let validSetCount = 0
    let thisWeekReps = 0
    let lastWeekReps = 0
    let thisMonthReps = 0
    let lastMonthReps = 0

    for (const s of sets) {
      if (s.exercise !== goal.exercise) continue
      const key = safePacificDayKey(s.logged_at)
      if (key === '') continue

      // All-time + active-day rollups.
      dailyReps.set(key, (dailyReps.get(key) ?? 0) + s.reps)
      allTimeReps += s.reps
      validSetCount += 1

      // Period buckets — string-compare against pre-computed boundary
      // keys. Each set falls into at most one week bucket and at most
      // one month bucket, but a day can be in both (e.g. Mon Apr 1 is
      // both "thisWeek" and "thisMonth"), so check independently.
      if (key >= thisWeekStart && key <= thisWeekEnd) thisWeekReps += s.reps
      else if (key >= lastWeekStart && key <= lastWeekEnd) lastWeekReps += s.reps

      if (key >= thisMonthStart && key <= thisMonthEnd) thisMonthReps += s.reps
      else if (key >= lastMonthStart && key <= lastMonthEnd) lastMonthReps += s.reps
    }

    const avgSetsPerActiveDay = dailyReps.size === 0 ? 0 : validSetCount / dailyReps.size
    const streak = streakFromDailyReps(dailyReps, targetResolverFor(scoringGoal), todayKey)

    return {
      exercise: goal.exercise,
      displayName: goal.display_name,
      color: goal.color,
      // Resolved through `scoringGoal` so the label and the streak agree. For
      // a permanent goal this is just today's target; for a focus it's the
      // rotation's, falling back to the anchor scalar when no window applies.
      dailyTarget: targetForDay(scoringGoal, todayKey),
      currentStreak: streak.current,
      longestStreak: streak.longest,
      thisWeekReps,
      lastWeekReps,
      thisMonthReps,
      lastMonthReps,
      avgSetsPerActiveDay,
      allTimeReps,
      targetChanges: goalTargetChanges(goal),
      ...(focusSummary !== null ? { focus: focusSummary } : {}),
    }
  })
}

/**
 * Roll one exercise's sets into a trailing run of weekly rep totals —
 * the data behind the History view's weekly-volume bar chart. Where the
 * heatmap answers "did I show up?" at daily granularity, this answers
 * "is my weekly volume trending up?" at a magnitude the heatmap's
 * capped color scale can't show.
 *
 * Weeks are ISO (Monday-anchored) so a bar lines up with the heatmap's
 * columns and the stats panel's week rollups. The series always spans
 * exactly `weeks` columns ending with the current week, back-filling
 * empty weeks with `0` so a training gap reads as a visible trough
 * rather than a missing bar. Sets whose `exercise` doesn't match
 * `goal.exercise` are ignored — call once per exercise.
 *
 * @param sets every logged set from {@link import('@/types/weight-room').WeightRoomData.sets};
 *   the helper filters to the matching exercise.
 * @param goal the {@link ExerciseGoal} for the target exercise.
 * @param weeks number of trailing weeks to emit, including the current
 *   one. Floored to an integer and clamped to a minimum of 1. Defaults
 *   to 12 (a quarter) — short enough that every bar can carry a legible
 *   date label.
 * @param now optional override for the "current week" anchor. Defaults
 *   to `new Date()`; tests pass a fixed date for determinism.
 */
export function buildWeeklyVolume(
  sets: readonly StrengthSet[],
  goal: ExerciseGoal,
  weeks = 12,
  now: Date = new Date()
): WeeklyVolumePoint[] {
  const span = Math.max(1, Math.floor(weeks))
  const currentMondayKey = mondayOfDayKey(pacificDayKey(now))
  const startMondayKey = shiftDayKey(currentMondayKey, -(span - 1) * DAYS_PER_WEEK)

  // weekKey (Monday YYYY-MM-DD, Pacific) → reps + set tallies for this exercise.
  const lookup = new Map<string, { reps: number; setCount: number }>()
  for (const s of sets) {
    if (s.exercise !== goal.exercise) continue
    const dayKey = safePacificDayKey(s.logged_at)
    if (dayKey === '') continue
    const key = mondayOfDayKey(dayKey)
    const entry = lookup.get(key) ?? { reps: 0, setCount: 0 }
    entry.reps += s.reps
    entry.setCount += 1
    lookup.set(key, entry)
  }

  const points: WeeklyVolumePoint[] = []
  for (let i = 0; i < span; i++) {
    // Calendar arithmetic, so a DST week can't land the key on a Sunday —
    // the snap-back through `getMondayOf` this replaces existed only to undo
    // that millisecond drift.
    const weekKey = shiftDayKey(startMondayKey, i * DAYS_PER_WEEK)
    const weekStart = dayKeyToPacificNoon(weekKey) ?? new Date(NaN)
    const entry = lookup.get(weekKey)
    points.push({
      weekStart,
      weekKey,
      label: `${monthIndexOfDayKey(weekKey) + 1}/${Number(weekKey.slice(8, 10))}`,
      reps: entry?.reps ?? 0,
      setCount: entry?.setCount ?? 0,
    })
  }
  return points
}
