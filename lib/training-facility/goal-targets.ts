import type { ExerciseGoal, GoalTargetPoint } from '@/types/weight-room'

/**
 * Effective-dated daily-target resolution for Weight Room goals (#362).
 *
 * `weight_room_goals.daily_target` is a single mutable scalar, so every
 * historical rollup that divided by it was really dividing by *today's*
 * target. Raising the pullups goal from 30 to 50 silently re-scored the
 * entire past: days that closed the ring at 30 stopped counting as hits,
 * streaks collapsed, and full-intensity heatmap cells dropped to half.
 * This module resolves the target that was actually live on a given day so
 * old reps keep the score they earned.
 *
 * All comparisons are lexicographic on bare `YYYY-MM-DD` strings. PostgREST
 * renders a Postgres `date` in that canonical zero-padded form, and every
 * day-key helper in this directory produces it, so string ordering *is*
 * chronological ordering — no `Date` parsing, and none of the UTC-midnight
 * hazards that come with it. Same reasoning as the module docblock in
 * `monthly-focus.ts`.
 *
 * Deliberately agnostic about *which* day-key convention the caller uses
 * (local vs Pacific — the two disagree across this directory, tracked in
 * #319). Callers pass the key they already compute; this module only orders
 * strings.
 */

/**
 * A target change worth surfacing on a chart — the moment the bar moved.
 * Produced by {@link goalTargetChanges}; rendered as a boundary marker on the
 * History view so a step in adherence is explained rather than mysterious.
 */
export interface GoalTargetChange {
  /** Target in effect immediately *before* {@link effective_from}. */
  from: number
  /** Target that took effect on {@link effective_from}. */
  to: number
  /** `YYYY-MM-DD` day the new target took effect (inclusive). */
  effective_from: string
}

/**
 * Sort target-history entries oldest-first without mutating the input.
 *
 * The data layer already orders by `effective_from`, but this module is the
 * one place that depends on the ordering being correct, so it re-establishes
 * it rather than trusting every future caller (a hand-built fixture, a
 * reordered query) to have done so.
 */
function sortedByEffectiveFrom(history: readonly GoalTargetPoint[]): GoalTargetPoint[] {
  return [...history].sort((a, b) =>
    a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0,
  )
}

/**
 * Clamp a target to a usable denominator. The DB CHECK and
 * `WeightRoomGoalRowSchema` both enforce `> 0`, but a 0 or negative slipping
 * through would divide-by-zero the heatmap `pct` and invert every hit-test —
 * so every read path floors at 1. Mirrors the belt-and-suspenders clamp the
 * rollups applied before this module existed.
 */
function clampTarget(target: number): number {
  return Math.max(1, target)
}

/**
 * The daily target that was in effect for `goal` on `dayKey`.
 *
 * Resolution is "the most recent entry whose `effective_from <= dayKey`".
 * Three fallbacks, all of which resolve to something usable rather than
 * throwing:
 *
 * - **No history** (absent or empty) — returns {@link ExerciseGoal.daily_target}
 *   for every day. This is exactly the pre-#362 behavior, so a goal the
 *   backfill missed degrades to the old semantics instead of breaking.
 * - **Day before the earliest entry** — returns the *earliest* known target
 *   rather than 0. Shouldn't happen after the backfill (which dates the seed
 *   entry at or before the earliest logged set), but a backdated set or a
 *   manually inserted future-dated goal could produce one, and scoring such a
 *   day against the oldest known bar beats dividing by nothing.
 * - **Empty `dayKey`** (an unparseable clock, which the day-key helpers signal
 *   with `''`) — returns the current target. `''` sorts before every real
 *   date, so without this it would take the before-earliest branch and score
 *   today against an ancient target.
 *
 * @param goal The goal whose target to resolve; reads `target_history` and
 *   falls back to `daily_target`.
 * @param dayKey `YYYY-MM-DD` key for the day being scored, in whatever
 *   convention the call site already uses.
 */
export function targetForDay(goal: ExerciseGoal, dayKey: string): number {
  const history = goal.target_history
  if (history === undefined || history.length === 0) {
    return clampTarget(goal.daily_target)
  }
  if (dayKey === '') {
    return clampTarget(goal.daily_target)
  }

  const sorted = sortedByEffectiveFrom(history)

  // Walk backward to the newest entry at or before `dayKey`. The history is
  // a handful of entries per exercise (a target changes a few times a year),
  // so a linear scan is cheaper than the binary search it would take to beat
  // it — and this runs once per heatmap cell, where the constant matters more
  // than the asymptote.
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].effective_from <= dayKey) {
      return clampTarget(sorted[i].daily_target)
    }
  }

  return clampTarget(sorted[0].daily_target)
}

/**
 * Bind {@link targetForDay} to one goal, yielding a `dayKey -> target`
 * function with the history resolved and sorted once.
 *
 * The rollups call this per goal and then invoke the returned resolver once
 * per day (every heatmap cell, every logged day in a streak scan). Hoisting
 * the sort out of that inner loop is the difference between sorting once and
 * sorting ~365 times per exercise per render.
 *
 * @param goal The goal whose target history to bind.
 */
export function targetResolverFor(goal: ExerciseGoal): (dayKey: string) => number {
  const history = goal.target_history
  const current = clampTarget(goal.daily_target)
  if (history === undefined || history.length === 0) {
    return () => current
  }

  const sorted = sortedByEffectiveFrom(history)
  const earliest = clampTarget(sorted[0].daily_target)

  return (dayKey: string): number => {
    if (dayKey === '') return current
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].effective_from <= dayKey) {
        return clampTarget(sorted[i].daily_target)
      }
    }
    return earliest
  }
}

/**
 * The points at which a goal's target actually moved, oldest first — the
 * data behind the History view's "goal 30 → 50, Aug 1" boundary markers.
 *
 * The oldest entry is the baseline, not a change, so it's never emitted:
 * a goal that has never been edited yields `[]` and renders no markers.
 * Consecutive entries with the same target (a same-value re-save, which the
 * write path avoids but a manual insert could create) are also skipped, so a
 * no-op edit doesn't draw a "30 → 30" marker.
 *
 * @param goal The goal whose history to summarize.
 */
export function goalTargetChanges(goal: ExerciseGoal): GoalTargetChange[] {
  const history = goal.target_history
  if (history === undefined || history.length < 2) return []

  const sorted = sortedByEffectiveFrom(history)
  const changes: GoalTargetChange[] = []
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1].daily_target
    const to = sorted[i].daily_target
    if (from === to) continue
    changes.push({ from, to, effective_from: sorted[i].effective_from })
  }
  return changes
}

/**
 * Format a change as a compact chart label, e.g. `30 → 50`. The effective
 * date is rendered separately by the marker (it's already positioned on that
 * column), so it isn't repeated here.
 *
 * @param change The change to label.
 */
export function formatGoalTargetChange(change: GoalTargetChange): string {
  return `${change.from} → ${change.to}`
}

/**
 * Format a change's effective date as a short `Aug 1` label.
 *
 * The bare `YYYY-MM-DD` is parsed at *local noon* so the rendered day can't
 * be shifted backwards by the viewer's UTC offset — the same guard
 * `formatFocusWindow` uses. Falls back to the raw key if it won't parse.
 *
 * @param change The change whose effective date to label.
 */
export function formatGoalTargetDate(change: GoalTargetChange): string {
  const d = new Date(change.effective_from + 'T12:00:00')
  if (!Number.isFinite(d.getTime())) return change.effective_from
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Full one-line description of a change — `30 → 50 on Aug 1`. Used by the
 * stats panel, where there's no column position to imply the date, and as
 * the accessible label for the heatmap's boundary marker.
 *
 * @param change The change to describe.
 */
export function describeGoalTargetChange(change: GoalTargetChange): string {
  return `${formatGoalTargetChange(change)} on ${formatGoalTargetDate(change)}`
}
