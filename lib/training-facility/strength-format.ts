/**
 * Load and set formatting shared by the Weight Room's strength surfaces.
 *
 * Extracted so the per-workout summary (#377) and the per-exercise trend (#412)
 * can't drift into printing the same set two different ways — one screen saying
 * `8 × 60 lb` while the other says `8 x 60lbs` is the kind of inconsistency
 * nobody files but everybody notices.
 *
 * **The unit is a display choice, not a fact about the number** (#427). Every
 * load in this codebase is stored in pounds, and these helpers still default to
 * printing `lb` in `en-US` — but plenty of gyms and most clinicians work in
 * kilos, so the label and the locale are parameters rather than literals. The
 * caller that knows its audience passes them; nobody else has to care.
 */

/** How a load should be rendered. */
export interface LoadFormatOptions {
  /**
   * Unit suffix appended after the number, e.g. `lb` or `kg`. Defaults to `lb`.
   *
   * Purely a **label** — no conversion happens. A caller displaying kilos is
   * responsible for having converted the value first; this helper will not
   * silently reinterpret a number it was handed.
   */
  unit?: string
  /** BCP-47 tag for thousands separators. Defaults to `en-US`. */
  locale?: string
}

/**
 * Format a load for display — whole units, thousands separated.
 *
 * Tonnage runs to five figures, where a decimal is noise; an Epley estimate is
 * an estimate, where a decimal is false precision. Neither wants fractions.
 *
 * @param value The load, in whatever unit `options.unit` names.
 * @param options Unit label and locale; see {@link LoadFormatOptions}.
 */
export function formatLbs(value: number, options: LoadFormatOptions = {}): string {
  const { unit = 'lb', locale = 'en-US' } = options
  return `${Math.round(value).toLocaleString(locale)} ${unit}`
}

/**
 * Render a set as `8 × 60 lb`, or `12 reps` when it carried no external load.
 *
 * @param reps Reps completed.
 * @param effectiveLoad Load actually moved — per-implement weight already
 *   multiplied by the movement's `load_multiplier`. `0` means bodyweight.
 * @param options Unit label and locale, forwarded to {@link formatLbs}.
 */
export function describeSet(
  reps: number,
  effectiveLoad: number,
  options: LoadFormatOptions = {}
): string {
  return effectiveLoad > 0 ? `${reps} × ${formatLbs(effectiveLoad, options)}` : `${reps} reps`
}

/**
 * Format a held set's duration — `45s`, `1:30` past a minute.
 *
 * Seconds alone stop reading as a duration somewhere around the two-minute
 * mark: `135s` has to be divided in the head, where `2:15` does not.
 *
 * @param seconds How long the set was held. Rounded — a hold is timed by
 *   glancing at a clock, and a decimal claims precision the source never had.
 */
export function formatHold(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  if (whole < 60) return `${whole}s`
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * Render a set, preferring its duration when it was a hold (#400).
 *
 * A plank is stored as one repetition lasting N seconds, so
 * {@link describeSet} would print `1 rep` — technically true and useless. Any
 * set carrying a duration is described by it instead, with the load appended
 * when the hold was weighted.
 *
 * @param set The set's reps, effective load, and duration if it had one.
 * @param options Unit label and locale, forwarded to {@link formatLbs}.
 */
export function describeSetOrHold(
  set: { reps: number; effectiveLoad: number; durationSeconds?: number | null },
  options: LoadFormatOptions = {}
): string {
  const { reps, effectiveLoad, durationSeconds } = set
  if (durationSeconds === undefined || durationSeconds === null || durationSeconds <= 0) {
    return describeSet(reps, effectiveLoad, options)
  }
  const hold = formatHold(durationSeconds)
  return effectiveLoad > 0 ? `${hold} × ${formatLbs(effectiveLoad, options)}` : hold
}
