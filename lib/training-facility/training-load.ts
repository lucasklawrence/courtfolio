/**
 * Training-load helpers: TRIMP-based ATL / CTL / TSB.
 *
 * Closes #78. The math is intentionally simple — a personal-tool
 * approximation, not a sports-science publication. Pure functions live here so
 * the chart layer stays declarative and the math is unit-testable without RTL.
 *
 * **Definitions**
 * - **TRIMP** (training impulse): per-session load score combining duration,
 *   relative HR effort, and modality stress. Formula is
 *   `duration_min × (avg_hr / max_hr) × intensityWeight(activity)` — the
 *   simplest form that still tracks subjective hard-vs-easy days. Sessions
 *   missing `avg_hr` contribute zero rather than imputing a value.
 * - **ATL** (acute training load): 7-day exponentially weighted moving
 *   average of daily TRIMP. Approximates "how loaded am I right now?"
 * - **CTL** (chronic training load): 28-day EWMA of daily TRIMP. Approximates
 *   "what's my recent baseline fitness?"
 * - **TSB** (training stress balance): `CTL − ATL`. Positive = chronically
 *   loaded but recently rested → fresh. Negative = recently loaded above
 *   chronic baseline → fatigued.
 *
 * **EMA decay constants**
 * Standard ATL/CTL τ = 7 / 28 days; α = `1 − exp(−1/τ)`. The series initializes
 * at zero (no bootstrap from earliest data); early values warm up over a few τ
 * — caller pre-warms the visible window if that's a problem (compute from the
 * earliest session, slice the display window).
 */

import { DEFAULT_MAX_HR } from '@/constants/hr-zones'
import type { CardioActivity, CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'

/**
 * Default max heart rate (BPM) used when no per-athlete value is supplied.
 * Re-exported from `constants/hr-zones.ts` so TRIMP callers don't need to
 * reach across module boundaries; the canonical definition lives there.
 * Override at runtime via {@link import('@/utils/useMaxHr').useMaxHr}.
 */
export { DEFAULT_MAX_HR }

/**
 * Per-modality intensity weighting applied to TRIMP. Stair sessions are the
 * most cardiovascularly demanding for a given duration and HR (vertical work
 * recruits more muscle); running is the baseline; walking is discounted
 * because pure HR-fraction overstates cardio stress at low ground impact.
 */
export const INTENSITY_WEIGHTS: Record<CardioActivity, number> = {
  stair: 1.2,
  running: 1.0,
  walking: 0.5,
}

/** ATL time constant in days (acute load). */
export const ATL_TAU_DAYS = 7
/** CTL time constant in days (chronic load). */
export const CTL_TAU_DAYS = 28
/** ATL smoothing factor `α = 1 − exp(−1/τ)` ≈ 0.1331. */
export const ATL_ALPHA = 1 - Math.exp(-1 / ATL_TAU_DAYS)
/** CTL smoothing factor `α = 1 − exp(−1/τ)` ≈ 0.0351. */
export const CTL_ALPHA = 1 - Math.exp(-1 / CTL_TAU_DAYS)

/** Optional knobs for {@link computeTRIMP}. */
export interface ComputeTrimpOptions {
  /** Max heart rate, BPM. Defaults to {@link DEFAULT_MAX_HR}. */
  maxHr?: number
  /** Override the modality weight for tests / what-if. */
  intensityWeights?: Record<CardioActivity, number>
}

/**
 * Compute TRIMP for a single session.
 *
 * Returns `0` when:
 * - `avg_hr` is missing or non-positive (no signal to weight by).
 * - `max_hr` is `0` or non-finite (would divide by zero).
 * - `duration_seconds` is missing or non-positive.
 *
 * Capping HR fraction at 1 prevents anomalous `avg_hr > max_hr` data (sensor
 * spike or under-set max) from inflating load — that scenario is a data
 * problem, not a real 1.2× effort.
 *
 * @param session - One `CardioSession`.
 * @param options - See {@link ComputeTrimpOptions}.
 */
export function computeTRIMP(
  session: CardioSession,
  options: ComputeTrimpOptions = {},
): number {
  const maxHr = options.maxHr ?? DEFAULT_MAX_HR
  const weights = options.intensityWeights ?? INTENSITY_WEIGHTS
  if (!Number.isFinite(maxHr) || maxHr <= 0) return 0
  if (typeof session.avg_hr !== 'number' || !Number.isFinite(session.avg_hr) || session.avg_hr <= 0) {
    return 0
  }
  if (
    typeof session.duration_seconds !== 'number' ||
    !Number.isFinite(session.duration_seconds) ||
    session.duration_seconds <= 0
  ) {
    return 0
  }
  const durationMin = session.duration_seconds / 60
  const hrFraction = Math.min(session.avg_hr / maxHr, 1)
  const weight = weights[session.activity] ?? 1.0
  return durationMin * hrFraction * weight
}

/** One row in the daily TRIMP series. */
export interface DailyTrimpPoint {
  /** Local-midnight `Date` for the day. Used as the x-scale value. */
  date: Date
  /** Local `YYYY-MM-DD` for keying. */
  isoDate: string
  /** Total TRIMP across all sessions on this day. Zero when no session. */
  trimp: number
}

/** Format a `Date` as `YYYY-MM-DD` in local time. */
function localIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse `YYYY-MM-DD` (local midnight) or pass an ISO timestamp through. */
function parseLocalDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`)
  return new Date(raw)
}

/**
 * Bin sessions into a contiguous daily TRIMP series. Days without a session
 * still appear (TRIMP = 0) so the EMA in {@link computeTrainingLoad} sees real
 * gaps as zero-input days rather than skipping them entirely. Same-day
 * sessions sum.
 *
 * The series spans from the earliest session's local-midnight day through
 * `endDate` (default: latest session). When `sessions` is empty, returns `[]`.
 *
 * @param sessions - All cardio sessions; activity-agnostic.
 * @param options - See {@link DailyTrimpSeriesOptions}.
 */
export interface DailyTrimpSeriesOptions {
  /** Inclusive end-of-series date. Defaults to the latest session date. */
  endDate?: Date
  /** Forwarded to {@link computeTRIMP}. */
  maxHr?: number
  /** Forwarded to {@link computeTRIMP}. */
  intensityWeights?: Record<CardioActivity, number>
}

export function dailyTrimpSeries(
  sessions: readonly CardioSession[],
  options: DailyTrimpSeriesOptions = {},
): DailyTrimpPoint[] {
  if (sessions.length === 0) return []

  const trimpByDay = new Map<string, number>()
  let earliestMs = Infinity
  let latestMs = -Infinity

  for (const s of sessions) {
    const d = parseLocalDate(s.date)
    const t = d.getTime()
    if (!Number.isFinite(t)) continue
    const iso = localIsoDate(d)
    const trimp = computeTRIMP(s, {
      maxHr: options.maxHr,
      intensityWeights: options.intensityWeights,
    })
    trimpByDay.set(iso, (trimpByDay.get(iso) ?? 0) + trimp)
    if (t < earliestMs) earliestMs = t
    if (t > latestMs) latestMs = t
  }

  if (!Number.isFinite(earliestMs)) return []

  const endMs = options.endDate ? options.endDate.getTime() : latestMs
  const out: DailyTrimpPoint[] = []
  // Walk by 24h ticks from earliest local midnight to end. Constructing each
  // day via `new Date(year, month, dayN)` would be safer across DST; using
  // ms-arithmetic is simpler and only off by an hour on DST-transition days,
  // which doesn't change which day a session bins to since `localIsoDate`
  // uses the date's own components.
  const dayMs = 24 * 60 * 60 * 1000
  for (let t = earliestMs; t <= endMs; t += dayMs) {
    const d = new Date(t)
    const iso = localIsoDate(d)
    out.push({
      date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
      isoDate: iso,
      trimp: trimpByDay.get(iso) ?? 0,
    })
  }
  return out
}

/** One row in the training-load output series. */
export interface TrainingLoadPoint {
  /** Local-midnight `Date` for the day. */
  date: Date
  /** Total TRIMP for the day (zero on rest days). */
  trimp: number
  /** Acute training load — 7-day EWMA of TRIMP. */
  atl: number
  /** Chronic training load — 28-day EWMA of TRIMP. */
  ctl: number
  /** Training stress balance — `CTL − ATL`. Positive = fresh. */
  tsb: number
}

/**
 * Run the EMA recurrence over a daily TRIMP series and emit ATL / CTL / TSB
 * day by day.
 *
 * Both EMAs initialize at zero. With no bootstrap, ATL / CTL ramp up from
 * zero over the first few τ — visible as a "warm-up" tail at the left edge
 * of the chart. Caller pre-warms by computing from the earliest session and
 * slicing the display window after the fact.
 *
 * @param series - Daily TRIMP series from {@link dailyTrimpSeries}.
 */
export function computeTrainingLoad(
  series: readonly DailyTrimpPoint[],
): TrainingLoadPoint[] {
  const out: TrainingLoadPoint[] = []
  let atl = 0
  let ctl = 0
  for (const p of series) {
    atl = atl + ATL_ALPHA * (p.trimp - atl)
    ctl = ctl + CTL_ALPHA * (p.trimp - ctl)
    out.push({ date: p.date, trimp: p.trimp, atl, ctl, tsb: ctl - atl })
  }
  return out
}

/** Optional knobs for {@link trainingLoadInRange}. */
export interface TrainingLoadInRangeOptions {
  /**
   * Forwarded to {@link dailyTrimpSeries}. When omitted, TRIMP uses
   * {@link DEFAULT_MAX_HR}. View containers pass the user's persisted value
   * from {@link import('@/utils/useMaxHr').useMaxHr} so all three Gym detail
   * surfaces share one runtime max-HR.
   */
  maxHr?: number
}

/**
 * One-shot helper for view containers: build the EMA-prewarmed training-load
 * series from the full session set, then clip to a `DateFilter` window.
 *
 * Pre-warming the EMA from the earliest session avoids the synthetic zero
 * ramp at the left edge of the visible window. Each detail view (Treadmill,
 * Stair, Track) wraps this in `useMemo` keyed on `[data, range, maxHr]`.
 *
 * @param sessions all cardio sessions (modality-agnostic — TRIMP is a
 *   whole-athlete metric, so callers should not pre-filter to one activity).
 * @param range the active `DateFilter` window; both endpoints are inclusive
 *   in millisecond comparisons.
 * @param options see {@link TrainingLoadInRangeOptions}.
 */
export function trainingLoadInRange(
  sessions: readonly CardioSession[],
  range: DateRange,
  options: TrainingLoadInRangeOptions = {},
): TrainingLoadPoint[] {
  if (sessions.length === 0) return []
  const series = dailyTrimpSeries(sessions, { maxHr: options.maxHr })
  if (series.length === 0) return []
  const full = computeTrainingLoad(series)
  const fromMs = range.start.getTime()
  const toMs = range.end.getTime()
  return full.filter((p) => {
    const t = p.date.getTime()
    return t >= fromMs && t <= toMs
  })
}

/** TSB zone classification thresholds (per issue #78). */
export const TSB_ZONES = {
  /** Below this is accumulated fatigue. */
  redMax: -10,
  /** Above this is functional overreach (yellow). */
  yellowMax: 5,
  /** Above this is optimal freshness (green). */
  greenMax: 25,
} as const

/** TSB zone label for a single value. `'over'` is "above optimal freshness" — fresh but possibly under-loaded. */
export type TsbZone = 'red' | 'yellow' | 'green' | 'over'

/**
 * Classify a single TSB value into a zone label. Intended for tooltips and
 * accessible labels; the chart itself paints horizontal bands.
 */
export function classifyTsb(tsb: number): TsbZone {
  if (!Number.isFinite(tsb)) return 'yellow'
  if (tsb < TSB_ZONES.redMax) return 'red'
  if (tsb <= TSB_ZONES.yellowMax) return 'yellow'
  if (tsb <= TSB_ZONES.greenMax) return 'green'
  return 'over'
}
