/**
 * Tendon-load ramp-rate thresholds for the Weight Room Load Management
 * panel (#316). Mirrors the tunable-config pattern of
 * {@link import('@/constants/hr-zones').HR_ZONES} and the `TSB_ZONES`
 * threshold object: the ceilings live here, not inline in the math, so
 * they can be dialed as tendons adapt without touching the aggregation
 * or the UI.
 *
 * **Why rate-of-change, not absolute volume:** the injury driver for
 * tendon is how fast weekly volume climbs relative to the tissue's
 * recent baseline. Two signals capture that:
 * - **WoW %** — week-over-week change in the trailing-7-day volume. A
 *   jump past {@link RampRateThresholds.wowYellowPct} outpaces the
 *   ~10%/week rule of thumb for safe progression.
 * - **ACWR** (acute:chronic workload ratio) — acute (7-day) volume over
 *   the chronic weekly baseline (28-day ÷ 4). The "sweet spot" band sits
 *   between {@link RampRateThresholds.acwrDetrainMax} and
 *   {@link RampRateThresholds.acwrGreenMax}; below is detraining, above
 *   is progressively elevated risk.
 */

/** Traffic-light severity for a single movement's ramp signals. */
export type RampFlag = 'green' | 'yellow' | 'red'

/**
 * Tunable ramp-rate ceilings. Fractions are unitless (`0.1` = 10%); ACWR
 * bounds are ratios. All comparisons treat the named bound as the top of
 * its band (see {@link classifyAcwr} / {@link classifyWowPct}).
 */
export interface RampRateThresholds {
  /**
   * Week-over-week volume increase above which the movement flags yellow.
   * `0.1` = +10%, the soft tendon-safe weekly ceiling. Only *increases*
   * trip this; volume drops are caught by the ACWR detraining band.
   */
  wowYellowPct: number
  /**
   * ACWR below this reads as detraining (yellow) — losing the chronic
   * base that protects the tendon. `0.8` per the classic acute:chronic
   * model.
   */
  acwrDetrainMax: number
  /**
   * Top of the ACWR "sweet spot". At or below this (and at/above
   * {@link RampRateThresholds.acwrDetrainMax}) is green. `1.3`.
   */
  acwrGreenMax: number
  /**
   * Top of the elevated-but-not-critical ACWR band. Above
   * {@link RampRateThresholds.acwrGreenMax} through this value is yellow;
   * above it is red. `1.5`.
   */
  acwrElevatedMax: number
}

/**
 * Default ramp-rate ceilings (#316). Personal-tool starting points, not
 * clinical constants — bump `wowYellowPct` as a movement's tendons
 * demonstrably tolerate faster ramps, tighten it after a flare.
 */
export const RAMP_RATE_THRESHOLDS: RampRateThresholds = {
  wowYellowPct: 0.1,
  acwrDetrainMax: 0.8,
  acwrGreenMax: 1.3,
  acwrElevatedMax: 1.5,
}

/** Display metadata for one {@link RampFlag} — the flag's color and human label. */
export interface RampFlagMeta {
  /** The flag this metadata describes. */
  flag: RampFlag
  /** Short human label for tooltips / accessible names, e.g. "Elevated risk". */
  label: string
  /**
   * Hex color for the flag dot. Green→red matching the HR-zone palette so
   * the two facilities read as one system. Hex (not Tailwind) so SVG can
   * consume it directly.
   */
  color: string
}

/** Flag color + label, keyed by {@link RampFlag}. Consumed by the panel UI. */
export const RAMP_FLAGS: Record<RampFlag, RampFlagMeta> = {
  green: { flag: 'green', label: 'On track', color: '#22c55e' },
  yellow: { flag: 'yellow', label: 'Caution', color: '#eab308' },
  red: { flag: 'red', label: 'Elevated risk', color: '#dc2626' },
}

/**
 * Numeric severity rank per flag (higher = worse). Used to pick the
 * worst flag across a movement's signals ({@link combineFlags}) and to
 * sort at-risk movements to the top of the panel.
 */
export const FLAG_SEVERITY: Record<RampFlag, number> = {
  green: 0,
  yellow: 1,
  red: 2,
}

/**
 * Classify an acute:chronic workload ratio into a traffic-light flag.
 *
 * `null` (no chronic baseline yet — too little history to judge) returns
 * `green`: there is nothing to flag, and the card renders the value as
 * "—" rather than a false alarm.
 *
 * @param acwr acute(7d) ÷ chronic-weekly(28d ÷ 4), or `null` when the
 *   chronic baseline is zero.
 * @param thresholds override the default {@link RAMP_RATE_THRESHOLDS}.
 */
export function classifyAcwr(
  acwr: number | null,
  thresholds: RampRateThresholds = RAMP_RATE_THRESHOLDS,
): RampFlag {
  if (acwr == null || !Number.isFinite(acwr)) return 'green'
  if (acwr < thresholds.acwrDetrainMax) return 'yellow'
  if (acwr <= thresholds.acwrGreenMax) return 'green'
  if (acwr <= thresholds.acwrElevatedMax) return 'yellow'
  return 'red'
}

/**
 * Classify a week-over-week volume change into a traffic-light flag.
 * Only increases past {@link RampRateThresholds.wowYellowPct} flag
 * yellow; flat-or-down weeks are green (a deliberate deload is not a
 * tendon risk). `null` (no prior week to compare) returns `green`.
 *
 * @param wowPct fractional change of trailing-7 volume vs the prior 7
 *   days (`0.14` = +14%), or `null` when the prior week had zero volume.
 * @param thresholds override the default {@link RAMP_RATE_THRESHOLDS}.
 */
export function classifyWowPct(
  wowPct: number | null,
  thresholds: RampRateThresholds = RAMP_RATE_THRESHOLDS,
): RampFlag {
  if (wowPct == null || !Number.isFinite(wowPct)) return 'green'
  return wowPct > thresholds.wowYellowPct ? 'yellow' : 'green'
}

/**
 * Reduce several per-signal flags to the single worst one (red beats
 * yellow beats green) — the color the movement's card shows overall.
 * With no arguments, returns `green`.
 */
export function combineFlags(...flags: RampFlag[]): RampFlag {
  return flags.reduce<RampFlag>(
    (worst, f) => (FLAG_SEVERITY[f] > FLAG_SEVERITY[worst] ? f : worst),
    'green',
  )
}
