/**
 * OrangeTheory (OTbeat) data types (#256).
 *
 * Consumed shape for the OrangeTheory Gym surface. Mirrors the
 * `otf_sessions` Supabase table (`supabase/migrations/20260628120000_otf_sessions.sql`)
 * and the parser record produced by `scripts/lib/otbeat-parser.mjs`. Field
 * names match the email's own data; the Zod row schemas in
 * `lib/schemas/otf.ts` are the validation source of truth and these
 * interfaces mirror them for IDE `Cmd/Ctrl+hover` ergonomics.
 *
 * KEEP IN SYNC WITH: `lib/schemas/otf.ts` and `scripts/lib/otbeat-parser.mjs`
 * (the `OtbeatTreadmill` / `OtbeatRower` JSDoc typedefs).
 */

/** Minutes spent in each OrangeTheory HR zone during a class. */
export interface OtfZoneMinutes {
  /** Gray zone (very light) minutes. */
  gray: number
  /** Blue zone (light) minutes. */
  blue: number
  /** Green zone (base/comfortable) minutes. */
  green: number
  /** Orange zone (challenging — counts toward splat) minutes. */
  orange: number
  /** Red zone (all-out — counts toward splat) minutes. */
  red: number
}

/**
 * Treadmill performance block for one class. Imperial units as the OTbeat
 * email reports them; paces/time are "MM:SS" strings. `null`/absent on
 * tread-only-omitting or belt-malfunction class formats.
 */
export interface OtfTreadmill {
  /** Total treadmill distance, miles. */
  distance_mi: number
  /** Total treadmill time, "MM:SS". */
  time: string
  /** Average speed, mph. */
  avg_mph?: number
  /** Max speed, mph. */
  max_mph?: number
  /** Average incline, percent. */
  avg_incline?: number
  /** Max incline, percent. */
  max_incline?: number
  /** Average pace, "MM:SS" per mile. */
  avg_pace?: string
  /** Fastest pace, "MM:SS" per mile. */
  fastest_pace?: string
  /** Total elevation gain, feet. */
  elevation_ft?: number
}

/**
 * Rower performance block for one class. Absent on class formats that omit
 * the rower (e.g. tread-only Endurance days).
 */
export interface OtfRower {
  /** Total rower distance, meters. */
  distance_m: number
  /** Total rower time, "MM:SS". */
  time: string
  /** Average wattage. */
  avg_watt?: number
  /** Max wattage. */
  max_watt?: number
  /** Average speed, km/h. */
  avg_kmh?: number
  /** Max speed, km/h. */
  max_kmh?: number
  /** Average 500m split, "MM:SS". */
  split_500m?: string
  /** Best 500m split, "MM:SS". */
  best_split_500m?: string
  /** Average stroke rate, strokes/min. */
  avg_spm?: number
}

/** One OrangeTheory studio class — one row in the OTF session log. */
export interface OtfSession {
  /** ISO timestamp of the class start (the table's primary key). */
  started_at: string
  /** Coach who ran the class. */
  coach?: string
  /** Studio location, e.g. "Marina Del Rey, CA". */
  studio?: string
  /** Calories burned. */
  calories?: number
  /** Splat points (minutes in orange + red zones). */
  splat?: number
  /** Step count. */
  steps?: number
  /** Average heart rate, BPM. */
  avg_hr?: number
  /** Peak heart rate, BPM. */
  peak_hr?: number
  /** Minutes per HR zone. Omitted when the email had no zone block. */
  zones_min?: OtfZoneMinutes
  /** Treadmill performance block. Omitted when the class format had none. */
  treadmill?: OtfTreadmill
  /** Rower performance block. Omitted when the class format had none. */
  rower?: OtfRower
  /**
   * True when the session is invalid/anomalous (e.g. an equipment malfunction)
   * and should be left out of every aggregate and chart — the session log still
   * lists it, muted. Auto-detected at ingest (#268) or set manually in Supabase.
   * Absent/false means a valid session.
   */
  excluded?: boolean
  /** Why the session was excluded (prefixed `auto:` when set by the ingest heuristic). Present only when {@link excluded}. */
  excluded_reason?: string
  /**
   * Coarse class-type label inferred at ingest from the machine signature
   * (#271): `'Tread + Row'`, `'Tread-focused'`, `'Row-focused'`, or
   * `'Strength / Floor'`. Absent for a near-zero malfunction. NOT OTF's
   * official format name — see {@link class_type_override}.
   */
  class_type?: string
  /**
   * Manually-set real OTF format name (e.g. `'2G'`, `'Strength 50'`) that wins
   * over {@link class_type}. Set by hand in Supabase; never written by the
   * append-only importer. The view uses `class_type_override ?? class_type` as
   * the effective type.
   */
  class_type_override?: string
}

/** Full OrangeTheory dataset consumed by the Gym OTF view. */
export interface OtfData {
  /** ISO timestamp of the most recent ingest (latest `updated_at`); drives the "last synced" display. */
  imported_at: string
  /** Every OTF session, ascending by `started_at`. */
  sessions: OtfSession[]
}

/**
 * One monthly-mileage milestone award tier (#321). Mirrors a row of
 * `public.otf_mileage_awards`
 * (`supabase/migrations/20260713120000_otf_mileage_awards.sql`).
 *
 * A calendar month "earns" this badge when its cumulative treadmill + rower
 * mileage reaches {@link OtfMileageAward.miles}. The ladder is owner-editable
 * at runtime via the admin settings page; the public OTF view reads it and
 * recomputes which months earned which badges statelessly on every render.
 *
 * KEEP IN SYNC WITH: the Zod schemas in `lib/schemas/otf.ts`.
 */
export interface OtfMileageAward {
  /** UUID primary key, generated server-side. */
  id: string
  /** Badge name, e.g. `Marathon`. Unique across the ladder. */
  label: string
  /**
   * Mileage threshold in miles. A month earns this badge when its cumulative
   * treadmill (`distance_mi`) + rower (`distance_m / 1609.344`) mileage reaches
   * this value. Always positive.
   */
  miles: number
  /**
   * Optional hex badge tint (e.g. `#F97316`). Absent lets the UI apply a
   * default accent rather than requiring a color per tier.
   */
  color?: string
}
