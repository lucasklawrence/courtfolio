/**
 * Cardio data schema (PRD §7.4).
 *
 * Single source of truth shared with the Python preprocessor's output
 * (`scripts/preprocess-health.py` → `public/data/cardio.json`) and any future
 * hosted API. Field names are snake_case to match Python output and on-disk
 * JSON. The shape here is the v1 scaffold — issue #58 (cardio.json import)
 * will refine field set and units as the real preprocessor lands.
 */

/** Which Gym equipment / activity produced the session (PRD §7.4). */
export type CardioActivity = 'stair' | 'running' | 'walking';

/** Heart-rate training zones 1–5. Definitions live in the shared HR-zone config (PRD §7.2). */
export type HrZone = 1 | 2 | 3 | 4 | 5;

/** A single cardio session — one row in the session log (PRD §7.4 detail views). */
export interface CardioSession {
  /** ISO timestamp or `YYYY-MM-DD` for the session start. */
  date: string;
  /** Equipment / activity type — drives which Gym detail view it shows up in. */
  activity: CardioActivity;
  /** Total elapsed time in seconds. */
  duration_seconds: number;
  /** Distance covered in meters. Omitted for activities where it doesn't apply. */
  distance_meters?: number;
  /** Average heart rate over the session, BPM. */
  avg_hr?: number;
  /** Peak heart rate observed during the session, BPM. */
  max_hr?: number;
  /** Pace as seconds per kilometer. Used for running and walking; stair sessions may omit. */
  pace_seconds_per_km?: number;
  /** Time spent in each HR zone, seconds. Powers the HR-zone distribution chart. */
  hr_seconds_in_zone?: Record<HrZone, number>;
  /** Cardiac efficiency = distance ÷ total heartbeats. Higher = more efficient (PRD §7.4). */
  meters_per_heartbeat?: number;
  /**
   * Raw HR sample stream for this session (#165). Omitted on aggregate
   * fetches that don't need the curve — the dashboard reads zone totals
   * from {@link hr_seconds_in_zone} instead. Populated by the per-session
   * detail page reader and by the Python preprocessor's JSON output.
   */
  hr_samples?: HrSample[];
}

/**
 * One Apple-Watch HR sample emitted inside a session window. The detail
 * page (`/training-facility/gym/session/[started_at]`) plots these as a
 * line chart over session-relative time. Stored row-per-row in
 * `cardio_session_hr_samples` and re-emitted into the legacy
 * `CardioData` JSON for parity with the shape the preprocessor writes.
 */
export interface HrSample {
  /** ISO timestamp with offset, matching {@link CardioSession.date}'s format. */
  ts: string;
  /** Heart rate in beats per minute. */
  bpm: number;
}

/** A single point on a daily/weekly trend line — used for resting HR and VO2max series. */
export interface CardioTimePoint {
  /** ISO date of the measurement. */
  date: string;
  /** Numeric value (BPM for resting HR, ml/kg/min for VO2max, etc.). */
  value: number;
}

/** Full cardio dataset — the shape of `public/data/cardio.json`. */
export interface CardioData {
  /** ISO timestamp of the most recent Apple Health import (drives the "last synced" wall display). */
  imported_at: string;
  /** Every session, all activities. Filtering by activity happens in components. */
  sessions: CardioSession[];
  /** Resting HR over time — feeds the wall HR monitor sparkline. */
  resting_hr_trend: CardioTimePoint[];
  /** VO2max over time — feeds the whiteboard chart. */
  vo2max_trend: CardioTimePoint[];
  /**
   * Heart-rate variability (SDNN) daily trend, milliseconds. Latest-wins
   * per day when Apple emits multiple records — matches `resting_hr_trend`'s
   * dedup convention. Optional: absent until the lifestyle-port migration
   * (#75 slice C-data) has been applied AND a chart consumes it.
   */
  hrv_trend?: CardioTimePoint[];
  /**
   * Walking heart-rate average daily trend, BPM. Latest-wins per day.
   * Optional — same scoping as {@link hrv_trend}.
   */
  walking_hr_trend?: CardioTimePoint[];
  /**
   * Body mass daily trend, **pounds** (Apple Health's `kg` is converted at
   * preprocess time so the dashboard renders without a unit-conversion
   * step). Latest-wins per day. Optional.
   */
  body_mass_trend?: CardioTimePoint[];
  /**
   * Daily step-count total. Summed from Apple's per-burst step records to
   * one value per local calendar day. Optional.
   */
  step_count_trend?: CardioTimePoint[];
  /**
   * Daily sleep total, **hours**. Only `HKCategoryValueSleepAnalysisAsleep*`
   * periods are counted — in-bed-but-awake time is excluded so "I got 7
   * hours of sleep" is the metric, not "I was in bed 8 hours." Each block
   * is attributed to the wake day (matches Apple Health's UI). Optional.
   */
  sleep_trend?: CardioTimePoint[];
  /**
   * Daily active-energy total, **kilocalories**. Summed from per-burst
   * records; kJ exports are converted to kcal at preprocess time. Optional.
   */
  active_energy_trend?: CardioTimePoint[];
}
