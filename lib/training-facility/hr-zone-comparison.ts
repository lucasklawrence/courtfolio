/**
 * Reconcile the two HR-zone systems feeding the Gym data (#261): Apple Watch /
 * cardio (`constants/hr-zones.ts`, even 10% bands, raw samples we bucket
 * ourselves) versus OrangeTheory (`lib/training-facility/otf.ts`, uneven bands,
 * pre-bucketed minutes from the OTbeat emails).
 *
 * The two don't line up — different band cut-points *and* different maxHR
 * baselines — so this module (1) derives one shared maxHR from real data (the
 * highest peak observed, a floor rather than a formula), and (2) projects both
 * systems onto it as bpm boundaries plus time-in-zone shares, side by side.
 *
 * It is pure and isomorphic — the view (`HrZoneComparison.tsx`) stays
 * rendering-only and imports these for the maxHR derivation and comparison
 * assembly. Deliberately does NOT re-bucket OTF minutes into Apple zones: the
 * OTbeat emails carry no raw samples, so an accurate remap is impossible (issue
 * #261, out of scope). The two systems are presented as parallel, not mapped.
 */

import { DEFAULT_MAX_HR, HR_ZONES, bpmRangeForZone } from '@/constants/hr-zones'
import type { CardioSession } from '@/types/cardio'
import type { OtfSession } from '@/types/otf'

import { OTF_ZONES, bpmRangeForOtfZone } from './otf'
import { aggregateOtfZoneMinutes } from './otf'
import { aggregateHrZoneSeconds } from './cardio-shared'

/** Where the resolved max HR came from. */
export type MaxHrSource = 'observed' | 'default'

/** The derived max-HR baseline both zone systems are projected onto. */
export interface ObservedMaxHr {
  /**
   * Max HR in BPM used for both systems' band boundaries. The highest peak
   * seen in the data when available (`source: 'observed'`), else
   * {@link DEFAULT_MAX_HR} (`source: 'default'`).
   */
  maxHr: number
  /** Whether {@link maxHr} came from observed data or the Fox-formula default. */
  source: MaxHrSource
  /**
   * Highest peak actually observed across the inputs, or `null` when no input
   * carried a usable peak. A *floor* on true max HR — the user may not have
   * truly maxed out — surfaced in the UI as "observed, auto-updating".
   */
  observedPeak: number | null
}

/** Inputs to {@link observedMaxHr} — either source may be empty/omitted. */
export interface ObservedMaxHrInputs {
  /** OrangeTheory sessions; each session's `peak_hr` is considered. */
  otfSessions?: readonly OtfSession[]
  /**
   * Apple cardio sessions; each session's `max_hr` and any `hr_samples` bpm
   * are considered (samples can exceed the stored `max_hr` on some exports).
   */
  cardioSessions?: readonly CardioSession[]
}

/**
 * Derive a shared max-HR baseline from real data: the highest peak seen across
 * OTF `peak_hr` and Apple `max_hr` / HR samples. Falls back to
 * {@link DEFAULT_MAX_HR} when nothing usable is present.
 *
 * The observed peak is treated as a floor (not a formula estimate), matching
 * the reconciliation goal of #261 — one baseline both models share, grounded in
 * data rather than `220 − age`. Non-finite and non-positive candidates are
 * ignored so a sensor glitch (`0`, `NaN`) can't poison the result.
 */
export function observedMaxHr(inputs: ObservedMaxHrInputs): ObservedMaxHr {
  let peak = 0
  const consider = (value: unknown): void => {
    if (typeof value === 'number' && Number.isFinite(value) && value > peak) {
      peak = value
    }
  }

  for (const s of inputs.otfSessions ?? []) consider(s.peak_hr)
  for (const s of inputs.cardioSessions ?? []) {
    consider(s.max_hr)
    for (const sample of s.hr_samples ?? []) consider(sample.bpm)
  }

  if (peak > 0) {
    return { maxHr: peak, source: 'observed', observedPeak: peak }
  }
  return { maxHr: DEFAULT_MAX_HR, source: 'default', observedPeak: null }
}

/** One zone's band boundaries plus its share of logged time, for one system. */
export interface ZoneTimeShare {
  /** Stable key — Apple `'Z1'`–`'Z5'` or OTF `'gray'`–`'red'`. */
  key: string
  /** Long label, e.g. "Aerobic Base" (Apple) or "Base" (OTF green). */
  label: string
  /** Short label, e.g. "Z2" (Apple) or "Green" (OTF). */
  shortLabel: string
  /** Display color from the source system's palette. */
  color: string
  /** Lower bpm bound at the shared maxHR, inclusive, rounded. */
  minBpm: number
  /** Upper bpm bound at the shared maxHR, rounded. */
  maxBpm: number
  /**
   * Time logged in this band across the input sessions, in the parent
   * {@link SystemZoneComparison.unit} — seconds (Apple) or minutes (OTF).
   */
  value: number
  /** Fraction 0–1 of the system's total time-in-zone this band holds; 0 when the system logged no time. */
  share: number
}

/** One HR-zone system (Apple or OTF) resolved to a shared maxHR, with time-in-zone. */
export interface SystemZoneComparison {
  /** Which system this describes. */
  system: 'apple' | 'otf'
  /** Human-facing system name — "Apple Watch" / "OrangeTheory". */
  label: string
  /** Unit of every band's `value` — Apple stores seconds, OTF stores minutes. */
  unit: 'seconds' | 'minutes'
  /** Per-band boundaries + time share, in the system's canonical order (low → high). */
  bands: ZoneTimeShare[]
  /** Sum of `value` across bands, same unit as `unit`. 0 when no data. */
  total: number
}

/** Both HR-zone systems projected onto one derived maxHR, ready to render side by side. */
export interface HrZoneComparison {
  /** The shared maxHR both systems' bpm boundaries were computed at. */
  maxHr: number
  /** Whether {@link maxHr} is data-observed or the formula default. */
  maxHrSource: MaxHrSource
  /** Highest peak observed across the inputs, or `null` when none. */
  observedPeak: number | null
  /** Apple even-band system (Z1–Z5), time-in-zone in seconds. */
  apple: SystemZoneComparison
  /** OrangeTheory uneven-band system (gray–red), time-in-zone in minutes. */
  otf: SystemZoneComparison
}

/** Options for {@link buildHrZoneComparison}. */
export interface BuildHrZoneComparisonOptions {
  /**
   * Explicit max HR to project both systems onto. When omitted, the value is
   * derived from the data via {@link observedMaxHr} — the default behavior for
   * #261's "observed peak, auto-updating" baseline. Pass a value to preview a
   * tested or hypothetical max.
   */
  maxHrOverride?: number
}

/**
 * Assemble the full {@link HrZoneComparison} from Apple cardio + OTF sessions.
 *
 * Resolves the shared maxHR (observed peak by default; `maxHrOverride` wins
 * when given), then projects each system's bands to bpm at that maxHR and folds
 * in time-in-zone: Apple seconds via {@link aggregateHrZoneSeconds}, OTF minutes
 * via {@link aggregateOtfZoneMinutes}. Each band's `share` is its fraction of
 * its *own* system's total — the two systems are never summed together, since
 * their bands and units differ.
 *
 * @param cardioSessions Apple cardio sessions (already range-filtered by the caller).
 * @param otfSessions OrangeTheory sessions (already range-filtered by the caller).
 */
export function buildHrZoneComparison(
  cardioSessions: readonly CardioSession[],
  otfSessions: readonly OtfSession[],
  options: BuildHrZoneComparisonOptions = {},
): HrZoneComparison {
  const derived = observedMaxHr({ cardioSessions, otfSessions })
  const override = options.maxHrOverride
  const useOverride = typeof override === 'number' && Number.isFinite(override) && override > 0
  const maxHr = useOverride ? override : derived.maxHr

  const appleSeconds = aggregateHrZoneSeconds(cardioSessions)
  const appleTotal = appleSeconds.reduce((acc, b) => acc + b.seconds, 0)
  const appleBands: ZoneTimeShare[] = HR_ZONES.map((zone, i) => {
    const [minBpm, maxBpm] = bpmRangeForZone(zone, maxHr)
    const seconds = appleSeconds[i]?.seconds ?? 0
    return {
      key: zone.id,
      label: zone.label,
      shortLabel: zone.shortLabel,
      color: zone.color,
      minBpm,
      maxBpm,
      value: seconds,
      share: appleTotal > 0 ? seconds / appleTotal : 0,
    }
  })

  const otfMinutes = aggregateOtfZoneMinutes(otfSessions)
  const otfTotal = otfMinutes.reduce((acc, b) => acc + b.minutes, 0)
  const otfBands: ZoneTimeShare[] = OTF_ZONES.map((zone, i) => {
    const [minBpm, maxBpm] = bpmRangeForOtfZone(zone, maxHr)
    const minutes = otfMinutes[i]?.minutes ?? 0
    return {
      key: zone.key,
      label: zone.label,
      shortLabel: zone.shortLabel,
      color: zone.color,
      minBpm,
      maxBpm,
      value: minutes,
      share: otfTotal > 0 ? minutes / otfTotal : 0,
    }
  })

  return {
    maxHr,
    maxHrSource: useOverride ? 'observed' : derived.source,
    observedPeak: derived.observedPeak,
    apple: {
      system: 'apple',
      label: 'Apple Watch',
      unit: 'seconds',
      bands: appleBands,
      total: appleTotal,
    },
    otf: {
      system: 'otf',
      label: 'OrangeTheory',
      unit: 'minutes',
      bands: otfBands,
      total: otfTotal,
    },
  }
}

/**
 * Average of a numeric session field across sessions that carry it, or `null`
 * when none do. Used by the comparison view to place "my avg OTF peak / avg HR"
 * against the derived bands — e.g. showing that an avg peak of 162 lands in red
 * under both systems.
 */
export function averageOf(
  sessions: readonly OtfSession[],
  field: 'peak_hr' | 'avg_hr',
): number | null {
  let sum = 0
  let count = 0
  for (const s of sessions) {
    const value = s[field]
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value
      count += 1
    }
  }
  return count > 0 ? sum / count : null
}

/**
 * Which band of a system contains `bpm`, or `null` when it falls below the
 * lowest band's floor. Bounds are inclusive on both ends (the published bands
 * already leave 1-bpm gaps for OTF); a bpm in a gap resolves to the nearest
 * lower band it satisfies. Used to annotate a marker (e.g. avg HR) with the
 * zone it lands in.
 */
export function bandForBpm(
  bands: readonly ZoneTimeShare[],
  bpm: number,
): ZoneTimeShare | null {
  let match: ZoneTimeShare | null = null
  for (const band of bands) {
    if (bpm >= band.minBpm) match = band
  }
  return match
}
