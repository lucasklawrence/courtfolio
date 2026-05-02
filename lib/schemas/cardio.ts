/**
 * Pure (isomorphic) Zod schemas for the cardio Supabase row contract.
 *
 * Three tables back the cardio dashboard (PRD §7.4):
 *   * `cardio_sessions`   — one row per workout
 *   * `cardio_resting_hr` — one row per measurement day
 *   * `cardio_vo2max`     — one row per measurement day
 *
 * The Zod schemas here are the single source of truth for what the
 * data layer (`lib/data/cardio.ts`) and the import script
 * (`scripts/import-health.mjs`) accept. The static `CardioData` /
 * `CardioSession` / `CardioTimePoint` types in `types/cardio.ts` mirror
 * them for IDE ergonomics — when the schema changes, update the static
 * type so component-side `Cmd+hover` stays accurate.
 *
 * Sibling pattern: `lib/schemas/movement.ts`.
 *
 * KEEP IN SYNC WITH: `scripts/lib/cardio-supabase.mjs`
 * (CardioDataSchema and sessionToRow duplicate the row-shape and the
 * write transform here; the .mjs file can't import this .ts without a
 * build step). A `grep "KEEP IN SYNC WITH"` audit is the working
 * substitute for cross-target imports.
 */

import { z } from 'zod'

import type {
  CardioActivity,
  CardioSession,
  CardioTimePoint,
  HrZone,
} from '@/types/cardio'

/** ISO calendar date in `YYYY-MM-DD` form. Used by the resting-HR and VO2max trend rows. */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Cardio activity types tracked by the v1 Gym surfaces. Must match the `activity` CHECK constraint on `cardio_sessions`. */
export const CardioActivitySchema = z.enum(['stair', 'running', 'walking'])

/**
 * Zod schema for one row of `public.cardio_sessions`. Mirrors the table
 * definition in `supabase/migrations/20260430120000_cardio_tables.sql`.
 *
 * - `started_at` is the session start as ISO 8601 timestamp; it is the
 *   primary key, so two sessions starting at the exact same instant
 *   would collide (vanishingly rare with second-precision timestamps).
 * - HR-zone seconds are five explicit columns rather than JSONB so a
 *   "time in Z3 over months" query stays a plain `select`.
 * - Optional fields use `.optional()` (not `.nullable()`) — Postgres
 *   `NULL` is mapped to absent before validation by `stripNulls()` in
 *   the data layer, which keeps this schema usable from both the read
 *   path (DB → undefined) and the import-script write path (caller
 *   passes undefined → Supabase serializes as null).
 */
export const CardioSessionRowSchema = z
  .object({
    started_at: z.string().min(1, 'started_at must be an ISO timestamp'),
    activity: CardioActivitySchema,
    duration_seconds: z.number().nonnegative(),
    distance_meters: z.number().nonnegative().optional(),
    avg_hr: z.number().nonnegative().optional(),
    max_hr: z.number().nonnegative().optional(),
    pace_seconds_per_km: z.number().nonnegative().optional(),
    zone1_seconds: z.number().nonnegative().optional(),
    zone2_seconds: z.number().nonnegative().optional(),
    zone3_seconds: z.number().nonnegative().optional(),
    zone4_seconds: z.number().nonnegative().optional(),
    zone5_seconds: z.number().nonnegative().optional(),
    meters_per_heartbeat: z.number().nonnegative().optional(),
  })
  .strict()

/** Validated `cardio_sessions` row inferred from {@link CardioSessionRowSchema}. */
export type CardioSessionRow = z.infer<typeof CardioSessionRowSchema>

/**
 * Zod schema for one row of `public.cardio_resting_hr` /
 * `public.cardio_vo2max`. Both tables share the shape `(date, value)`,
 * keyed by calendar date so a re-import overwrites rather than
 * duplicates the same day's measurement.
 */
export const CardioTrendRowSchema = z
  .object({
    date: z.string().regex(DATE_REGEX, 'date must be YYYY-MM-DD'),
    value: z.number(),
  })
  .strict()

/** Validated `cardio_resting_hr` / `cardio_vo2max` row inferred from {@link CardioTrendRowSchema}. */
export type CardioTrendRow = z.infer<typeof CardioTrendRowSchema>

/**
 * Translate a validated `cardio_sessions` row (snake_case zone columns)
 * into the legacy `CardioSession` shape (`hr_seconds_in_zone` nested
 * map) that components consume today. Applied by the data layer on
 * read so existing visualizations don't change after the
 * Supabase migration.
 *
 * A session with no HR data (Apple Watch off) leaves every zone column
 * null; in that case `hr_seconds_in_zone` is omitted entirely rather
 * than emitted as a map of five zeros, which would render as "all
 * zones at zero" in the dashboard instead of empty.
 */
export function sessionRowToCardioSession(row: CardioSessionRow): CardioSession {
  const session: CardioSession = {
    date: row.started_at,
    activity: row.activity as CardioActivity,
    duration_seconds: row.duration_seconds,
  }
  if (row.distance_meters !== undefined) session.distance_meters = row.distance_meters
  if (row.avg_hr !== undefined) session.avg_hr = row.avg_hr
  if (row.max_hr !== undefined) session.max_hr = row.max_hr
  if (row.pace_seconds_per_km !== undefined) {
    session.pace_seconds_per_km = row.pace_seconds_per_km
  }
  if (row.meters_per_heartbeat !== undefined) {
    session.meters_per_heartbeat = row.meters_per_heartbeat
  }
  const zones: Record<HrZone, number | undefined> = {
    1: row.zone1_seconds,
    2: row.zone2_seconds,
    3: row.zone3_seconds,
    4: row.zone4_seconds,
    5: row.zone5_seconds,
  }
  if ((Object.values(zones) as Array<number | undefined>).some((v) => v !== undefined)) {
    session.hr_seconds_in_zone = {
      1: zones[1] ?? 0,
      2: zones[2] ?? 0,
      3: zones[3] ?? 0,
      4: zones[4] ?? 0,
      5: zones[5] ?? 0,
    }
  }
  return session
}

/**
 * Translate a legacy `CardioSession` (the shape produced by
 * `scripts/preprocess-health.py` and matching `types/cardio.ts`) into
 * the snake_case row payload accepted by `cardio_sessions.upsert(...)`.
 *
 * Used by the import script (`scripts/import-health.mjs`) and the
 * one-shot backfill (`scripts/backfill-cardio.mjs`). Maps absent /
 * `null` legacy fields to explicit `null`s so an upsert that re-imports
 * a session whose HR data has since been removed clears the old zone
 * values instead of leaving stale numbers behind.
 *
 * @param session Legacy session object (e.g. parsed from
 *   `public/data/cardio.json`). The Python preprocessor emits some
 *   fields as `null` when missing — those map to `null` in Postgres.
 */
export function cardioSessionToRow(session: {
  date: string
  activity: string
  duration_seconds: number
  distance_meters?: number | null
  avg_hr?: number | null
  max_hr?: number | null
  pace_seconds_per_km?: number | null
  hr_seconds_in_zone?: Record<string, number> | null
  meters_per_heartbeat?: number | null
}): Record<string, unknown> {
  const zones = session.hr_seconds_in_zone ?? null
  return {
    started_at: session.date,
    activity: session.activity,
    duration_seconds: session.duration_seconds,
    distance_meters: session.distance_meters ?? null,
    avg_hr: session.avg_hr ?? null,
    max_hr: session.max_hr ?? null,
    pace_seconds_per_km: session.pace_seconds_per_km ?? null,
    zone1_seconds: zones?.['1'] ?? null,
    zone2_seconds: zones?.['2'] ?? null,
    zone3_seconds: zones?.['3'] ?? null,
    zone4_seconds: zones?.['4'] ?? null,
    zone5_seconds: zones?.['5'] ?? null,
    meters_per_heartbeat: session.meters_per_heartbeat ?? null,
  }
}

/**
 * Translate a validated trend row into the legacy
 * {@link CardioTimePoint} shape. The DB row already matches the
 * legacy shape (`{ date, value }`), so this is a typed pass-through —
 * present mostly for symmetry with `sessionRowToCardioSession` and to
 * give the data layer a single import surface.
 */
export function trendRowToTimePoint(row: CardioTrendRow): CardioTimePoint {
  return { date: row.date, value: row.value }
}
