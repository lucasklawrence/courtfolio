/**
 * Load and set formatting shared by the Weight Room's strength surfaces.
 *
 * Extracted so the per-workout summary (#377) and the per-exercise trend (#412)
 * can't drift into printing the same set two different ways — one screen saying
 * `8 × 60 lb` while the other says `8 x 60lbs` is the kind of inconsistency
 * nobody files but everybody notices.
 */

/**
 * Format pounds for display — whole pounds, thousands separated.
 *
 * Tonnage runs to five figures, where a decimal is noise; an Epley estimate is
 * an estimate, where a decimal is false precision. Neither wants fractions.
 */
export function formatLbs(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} lb`
}

/**
 * Render a set as `8 × 60 lb`, or `12 reps` when it carried no external load.
 *
 * @param reps Reps completed.
 * @param effectiveLoad Pounds actually moved — per-implement weight already
 *   multiplied by the movement's `load_multiplier`. `0` means bodyweight.
 */
export function describeSet(reps: number, effectiveLoad: number): string {
  return effectiveLoad > 0 ? `${reps} × ${formatLbs(effectiveLoad)}` : `${reps} reps`
}
