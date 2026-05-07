import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/**
 * Pure helpers for the Weight Room Today View (#80) — date bucketing,
 * per-exercise totals, and ring-percent computation. Lives separate
 * from the React components so the math has unit-test coverage without
 * any DOM mounted, and so {@link computeRingPercent} can be reused by
 * the future History View (#81) when it shows "today" alongside the
 * heatmap.
 *
 * All date math runs in the *caller's* local timezone. The Today View
 * is by definition "what happened on this calendar day" — the user
 * looking at a phone in Pacific time wants their local midnight
 * boundary, not UTC's.
 */

/**
 * Local-date key (`YYYY-MM-DD`) for an ISO timestamp string or a Date.
 * Strips off the time-of-day so two sets logged at 06:00 and 23:00 of
 * the same day collapse to the same key.
 *
 * @param input ISO 8601 timestamp string from
 *   {@link StrengthSet.logged_at}, or a Date already constructed by
 *   the caller.
 * @returns `YYYY-MM-DD` in the caller's local timezone, or `''` when
 *   `input` is unparseable (so callers can use `key === ''` as a skip
 *   condition without throwing).
 */
export function toLocalDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (!Number.isFinite(d.getTime())) return ''
  const yyyy = d.getFullYear().toString().padStart(4, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Filter `sets` down to those logged on a specific local-date key.
 * Used by the Today View to slice the full sets array (which spans
 * the whole history) down to just today's logs without re-querying.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param dayKey `YYYY-MM-DD` key as produced by {@link toLocalDateKey}.
 *   Pass an empty string to get an empty array back (defensive — keeps
 *   callers from having to special-case unparseable "now" inputs).
 */
export function filterSetsForDay(
  sets: readonly StrengthSet[],
  dayKey: string,
): StrengthSet[] {
  if (dayKey === '') return []
  return sets.filter((s) => toLocalDateKey(s.logged_at) === dayKey)
}

/**
 * Sum reps across a slice of sets. Trivial helper, but named so call
 * sites read as intent ("today's total") rather than a generic reduce.
 *
 * @param sets Sets to sum — usually one exercise on one day.
 */
export function sumReps(sets: readonly StrengthSet[]): number {
  let total = 0
  for (const s of sets) total += s.reps
  return total
}

/**
 * Per-exercise rep total for a day. Returns a Map keyed by exercise so
 * {@link ActivityRings} and {@link QuickLog} can both pull "what's the
 * current count for pushups?" in O(1) without re-filtering the array.
 *
 * @param setsForDay Output of {@link filterSetsForDay}.
 */
export function totalsByExercise(
  setsForDay: readonly StrengthSet[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const s of setsForDay) {
    totals.set(s.exercise, (totals.get(s.exercise) ?? 0) + s.reps)
  }
  return totals
}

/**
 * Fraction of `goal.daily_target` that today's reps cover. Returned
 * unclamped — callers that animate a ring usually `Math.min(1, …)` the
 * stroke offset, but the center-text "75 / 100" surface keeps the raw
 * value so a 110-rep day reads as "110 / 100" not "100 / 100".
 *
 * Returns `0` when `goal.daily_target` is non-positive (defensive
 * against a future settings UI accepting 0 — the schema currently
 * enforces `> 0`, but the helper shouldn't `Infinity` if that changes).
 *
 * @param totalReps Total reps logged for the exercise today, usually
 *   sourced from {@link totalsByExercise}.
 * @param goal The exercise's configured goal.
 */
export function computeRingPercent(
  totalReps: number,
  goal: ExerciseGoal,
): number {
  if (goal.daily_target <= 0) return 0
  return totalReps / goal.daily_target
}
