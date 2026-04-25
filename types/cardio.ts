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
}
