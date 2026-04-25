/**
 * Cardio data schema (PRD §7.4).
 *
 * Single source of truth shared with the Python preprocessor's output
 * (`scripts/preprocess-health.py` → `public/data/cardio.json`) and any future
 * hosted API. Field names are snake_case to match Python output and on-disk
 * JSON. The shape here is the v1 scaffold — issue #58 (cardio.json import)
 * will refine field set and units as the real preprocessor lands.
 */

export type CardioActivity = 'stair' | 'running' | 'walking';

export type HrZone = 1 | 2 | 3 | 4 | 5;

export interface CardioSession {
  date: string;
  activity: CardioActivity;
  duration_seconds: number;
  distance_meters?: number;
  avg_hr?: number;
  max_hr?: number;
  pace_seconds_per_km?: number;
  hr_seconds_in_zone?: Record<HrZone, number>;
  meters_per_heartbeat?: number;
}

export interface CardioTimePoint {
  date: string;
  value: number;
}

export interface CardioData {
  imported_at: string;
  sessions: CardioSession[];
  resting_hr_trend: CardioTimePoint[];
  vo2max_trend: CardioTimePoint[];
}
