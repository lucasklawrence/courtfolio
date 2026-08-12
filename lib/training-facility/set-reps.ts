/**
 * Reading a set's rep count when it may not have been recorded (#440).
 *
 * `StrengthSet.reps` became nullable so a rack-run drop can state its load
 * without claiming a rep count it never had. Every reader now has to decide
 * what an unrecorded count means *for that reader*, and the two answers differ:
 *
 * - **Summing** — volume, tonnage, goal rings, heatmap intensity. Unknown work
 *   contributes nothing, so `0`. Not because the set was empty, but because
 *   inventing a number is what this whole change exists to stop.
 * - **Showing** — a set list, a top-set line. Unknown is not a number, so it
 *   renders as a dash and never as `0 reps`.
 *
 * Two named helpers rather than one, so a call site says which it meant.
 */
import type { StrengthSet } from '@/types/weight-room'

/**
 * A set's reps for arithmetic — `0` when the count was never recorded.
 *
 * @param set The set, or just its rep count.
 * @returns Reps to add into a total; `0` for an unrecorded count.
 */
export function countedReps(set: Pick<StrengthSet, 'reps'> | number | null | undefined): number {
  if (typeof set === 'number') return set
  if (set === null || set === undefined) return 0
  return set.reps ?? 0
}

/**
 * Whether a set actually carries a rep count.
 *
 * Use to branch display, and to exclude a set from a statistic that would be
 * meaningless without one — a "most reps in a set" record can't consider a set
 * whose reps are unknown.
 */
export function hasRecordedReps(set: Pick<StrengthSet, 'reps'>): boolean {
  return typeof set.reps === 'number'
}

/**
 * A set's reps for display — the number, or a dash when unrecorded.
 *
 * @param set The set, or just its rep count.
 * @param dash What to render for an unrecorded count; defaults to an em dash.
 */
export function repsLabel(
  set: Pick<StrengthSet, 'reps'> | number | null | undefined,
  dash = '—'
): string {
  const reps = typeof set === 'number' ? set : (set?.reps ?? null)
  return reps === null || reps === undefined ? dash : String(reps)
}
