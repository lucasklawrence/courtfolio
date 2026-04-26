/**
 * Heart-rate zone config for the Gym (cardio) viz (PRD §7.2, §7.7).
 *
 * Zones are expressed as fractions of a person's max HR; the actual BPM
 * boundaries depend on whose data is being visualized. Visualizations
 * resolve a session's HR samples into zones via {@link hrZoneForBpm}
 * given the user's max-HR estimate.
 *
 * The default max-HR estimate uses the Fox formula (`220 - age`); callers
 * with a measured max should override. Tanaka (`208 - 0.7 * age`) is more
 * accurate for older athletes — adopt-when-needed, not pre-built.
 */

/** Zone identifiers, lowest intensity to highest. */
export type HrZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

/**
 * One heart-rate zone as a fraction of max HR. Bounds are inclusive on
 * `minPct` and exclusive on `maxPct` except for `Z5`, whose `maxPct` is
 * inclusive — otherwise a sample at exactly 100% maxHR falls outside
 * every zone.
 */
export interface HrZoneConfig {
  /** Stable zone id used as a categorical key in charts/configs. */
  id: HrZoneId
  /** Long display name — e.g. "Aerobic Base". Used in tooltips and legends. */
  label: string
  /** Short label — e.g. "Z2". Used on dense axes and badges. */
  shortLabel: string
  /** Lower bound as a fraction of max HR. Inclusive. */
  minPct: number
  /**
   * Upper bound as a fraction of max HR. Exclusive (`< maxPct`) for
   * Z1–Z4, inclusive (`<= maxPct`) for Z5 so 100% maxHR samples fall in
   * Z5 instead of off the chart.
   */
  maxPct: number
  /**
   * Display color for charts/legends — green→red gradient roughly
   * tracking effort. Hex strings rather than Tailwind classes so the
   * config stays consumable by SVG/canvas viz that can't read Tailwind.
   */
  color: string
}

/**
 * The five training zones, lowest intensity first. Matches the cardio
 * dashboard's existing 5-zone model (the source data set being migrated
 * per PRD §7.2).
 */
export const HR_ZONES: readonly HrZoneConfig[] = [
  { id: 'Z1', label: 'Recovery', shortLabel: 'Z1', minPct: 0.5, maxPct: 0.6, color: '#22c55e' },
  { id: 'Z2', label: 'Aerobic Base', shortLabel: 'Z2', minPct: 0.6, maxPct: 0.7, color: '#84cc16' },
  { id: 'Z3', label: 'Tempo', shortLabel: 'Z3', minPct: 0.7, maxPct: 0.8, color: '#eab308' },
  { id: 'Z4', label: 'Threshold', shortLabel: 'Z4', minPct: 0.8, maxPct: 0.9, color: '#f97316' },
  { id: 'Z5', label: 'VO2 Max', shortLabel: 'Z5', minPct: 0.9, maxPct: 1.0, color: '#dc2626' },
] as const

/** Default max-HR estimate when the consumer doesn't pass one. ~35-year-old via Fox formula. */
export const DEFAULT_MAX_HR = 185

/**
 * Estimate max heart rate (Fox formula). Returns BPM. Callers with a
 * measured max from a treadmill or watch should pass that directly to
 * {@link hrZoneForBpm} instead of using this estimator.
 *
 * @throws {RangeError} when `age` is not a finite number in `[1, 120]`.
 */
export function estimateMaxHr(age: number): number {
  if (!Number.isFinite(age) || age < 1 || age > 120) {
    throw new RangeError(`estimateMaxHr: age must be a finite number in [1, 120], got ${age}`)
  }
  return 220 - age
}

/**
 * Bucket a single BPM sample into one of the five zones. Returns `null`
 * for samples below Z1's lower bound (resting / sub-aerobic) so callers
 * can decide whether to count "below Z1" time toward Z1 or display it
 * separately. Above-100% samples (rare; usually a sensor glitch) clamp
 * into Z5.
 *
 * @param bpm - Sample heart rate in beats per minute.
 * @param maxHr - User's max HR in BPM. Defaults to {@link DEFAULT_MAX_HR}.
 */
export function hrZoneForBpm(bpm: number, maxHr: number = DEFAULT_MAX_HR): HrZoneId | null {
  if (maxHr <= 0) return null
  const pct = bpm / maxHr
  for (const zone of HR_ZONES) {
    const isLast = zone.id === 'Z5'
    if (pct >= zone.minPct && (isLast ? pct <= zone.maxPct : pct < zone.maxPct)) {
      return zone.id
    }
  }
  // Above 100% maxHR — clamp into the top zone rather than dropping the sample.
  if (pct > 1) return 'Z5'
  return null
}

/**
 * Resolve a zone's literal BPM range for a given user. Useful when a
 * chart wants to label axis ticks with concrete BPM values rather than
 * percentages.
 *
 * @returns `[minBpm, maxBpm]` rounded to whole BPM.
 */
export function bpmRangeForZone(
  zone: HrZoneConfig,
  maxHr: number = DEFAULT_MAX_HR,
): [number, number] {
  return [Math.round(zone.minPct * maxHr), Math.round(zone.maxPct * maxHr)]
}
