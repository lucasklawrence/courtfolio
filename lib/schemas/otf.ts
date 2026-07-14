/**
 * Pure (isomorphic) Zod schemas for the `otf_sessions` Supabase row
 * contract (#256).
 *
 * One table backs the OrangeTheory Gym view: `public.otf_sessions`
 * (`supabase/migrations/20260628120000_otf_sessions.sql`). These schemas
 * are the single source of truth for what the data layer
 * (`lib/data/otf-shared.ts`) accepts on read; the static interfaces in
 * `types/otf.ts` mirror them for IDE ergonomics.
 *
 * Sibling pattern: `lib/schemas/cardio.ts`.
 *
 * KEEP IN SYNC WITH: `scripts/lib/otbeat-supabase.mjs` (`recordToRow`
 * writes the snake_case columns read back here) and `types/otf.ts`.
 */

import { z } from 'zod'

import type { OtfMileageAward, OtfSession } from '@/types/otf'

/**
 * Treadmill JSONB block. Non-strict (extra keys stripped, not rejected) so
 * a future parser field doesn't break reads before the schema catches up.
 */
export const OtfTreadmillSchema = z.object({
  distance_mi: z.number(),
  time: z.string(),
  avg_mph: z.number().optional(),
  max_mph: z.number().optional(),
  avg_incline: z.number().optional(),
  max_incline: z.number().optional(),
  avg_pace: z.string().optional(),
  fastest_pace: z.string().optional(),
  elevation_ft: z.number().optional(),
})

/** Rower JSONB block. Non-strict, same rationale as {@link OtfTreadmillSchema}. */
export const OtfRowerSchema = z.object({
  distance_m: z.number(),
  time: z.string(),
  avg_watt: z.number().optional(),
  max_watt: z.number().optional(),
  avg_kmh: z.number().optional(),
  max_kmh: z.number().optional(),
  split_500m: z.string().optional(),
  best_split_500m: z.string().optional(),
  avg_spm: z.number().optional(),
})

/**
 * Zod schema for one row of `public.otf_sessions`.
 *
 * - `started_at` is the ISO 8601 class-start timestamp and the primary key.
 * - Zone minutes are five explicit `zone_*_min` columns (queryable without
 *   unpacking JSONB), mirroring `cardio_sessions`' zone columns.
 * - `treadmill` / `rower` are JSONB blocks, validated by the schemas above.
 * - Optional fields use `.optional()` (not `.nullable()`): Postgres `NULL`
 *   is mapped to absent by `stripNulls()` in the data layer before
 *   validation, so the schema only ever sees a value or `undefined`.
 * - `.strict()` so a column added to the table without updating this
 *   schema/whitelist fails loudly rather than leaking through.
 */
export const OtfSessionRowSchema = z
  .object({
    started_at: z.string().min(1, 'started_at must be an ISO timestamp'),
    coach: z.string().optional(),
    studio: z.string().optional(),
    calories: z.number().nonnegative().optional(),
    splat: z.number().nonnegative().optional(),
    steps: z.number().nonnegative().optional(),
    avg_hr: z.number().nonnegative().optional(),
    peak_hr: z.number().nonnegative().optional(),
    zone_gray_min: z.number().nonnegative().optional(),
    zone_blue_min: z.number().nonnegative().optional(),
    zone_green_min: z.number().nonnegative().optional(),
    zone_orange_min: z.number().nonnegative().optional(),
    zone_red_min: z.number().nonnegative().optional(),
    treadmill: OtfTreadmillSchema.optional(),
    rower: OtfRowerSchema.optional(),
    excluded: z.boolean().optional(),
    excluded_reason: z.string().optional(),
    class_type: z.string().optional(),
    class_type_override: z.string().optional(),
  })
  .strict()

/** Validated `otf_sessions` row inferred from {@link OtfSessionRowSchema}. */
export type OtfSessionRow = z.infer<typeof OtfSessionRowSchema>

/**
 * Translate a validated `otf_sessions` row (flat `zone_*_min` columns) into
 * the consumed {@link OtfSession} shape (nested `zones_min` map). Applied by
 * the data layer on read.
 *
 * Zone minutes are folded into a single `zones_min` object only when at
 * least one zone column is present; a session with no zone block omits
 * `zones_min` entirely rather than rendering as five zeros (matches the
 * `sessionRowToCardioSession` convention).
 */
export function otfRowToSession(row: OtfSessionRow): OtfSession {
  const session: OtfSession = { started_at: row.started_at }
  if (row.coach !== undefined) session.coach = row.coach
  if (row.studio !== undefined) session.studio = row.studio
  if (row.calories !== undefined) session.calories = row.calories
  if (row.splat !== undefined) session.splat = row.splat
  if (row.steps !== undefined) session.steps = row.steps
  if (row.avg_hr !== undefined) session.avg_hr = row.avg_hr
  if (row.peak_hr !== undefined) session.peak_hr = row.peak_hr

  const zones = {
    gray: row.zone_gray_min,
    blue: row.zone_blue_min,
    green: row.zone_green_min,
    orange: row.zone_orange_min,
    red: row.zone_red_min,
  }
  if ((Object.values(zones) as Array<number | undefined>).some(v => v !== undefined)) {
    session.zones_min = {
      gray: zones.gray ?? 0,
      blue: zones.blue ?? 0,
      green: zones.green ?? 0,
      orange: zones.orange ?? 0,
      red: zones.red ?? 0,
    }
  }

  if (row.treadmill !== undefined) session.treadmill = row.treadmill
  if (row.rower !== undefined) session.rower = row.rower
  if (row.excluded !== undefined) session.excluded = row.excluded
  if (row.excluded_reason !== undefined) session.excluded_reason = row.excluded_reason
  if (row.class_type !== undefined) session.class_type = row.class_type
  if (row.class_type_override !== undefined) session.class_type_override = row.class_type_override
  return session
}

/**
 * Zod schema for one row of `public.otf_mileage_awards` (#321) on read.
 * `.strict()` so a column added to the table without updating this schema /
 * the data-layer whitelist fails loudly instead of leaking to the view.
 * `color` is `.optional()` (not `.nullable()`): the data layer maps Postgres
 * `NULL` → absent before validation, matching {@link OtfSessionRowSchema}.
 */
export const OtfMileageAwardRowSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().min(1),
    miles: z.number().positive(),
    color: z.string().optional(),
  })
  .strict()

/** Validated `otf_mileage_awards` row inferred from {@link OtfMileageAwardRowSchema}. */
export type OtfMileageAwardRow = z.infer<typeof OtfMileageAwardRowSchema>

/** Translate a validated `otf_mileage_awards` row into the consumed {@link OtfMileageAward} shape. */
export function otfMileageAwardRowToAward(row: OtfMileageAwardRow): OtfMileageAward {
  const award: OtfMileageAward = { id: row.id, label: row.label, miles: row.miles }
  if (row.color !== undefined) award.color = row.color
  return award
}

/**
 * Request-body schema for creating a mileage award tier via the admin route
 * (`POST /api/admin/otf/mileage-awards`). `label` is trimmed and length-capped;
 * `miles` must be positive; `color` is optional (UI applies a default accent
 * when absent). Extra keys are stripped.
 */
export const OtfMileageAwardCreateSchema = z.object({
  label: z.string().trim().min(1, 'label is required').max(60, 'label is too long'),
  miles: z.number().positive('miles must be positive'),
  color: z.string().trim().min(1).optional(),
})

/** Validated create payload inferred from {@link OtfMileageAwardCreateSchema}. */
export type OtfMileageAwardCreate = z.infer<typeof OtfMileageAwardCreateSchema>

/**
 * Request-body schema for editing a tier via the admin item route
 * (`PATCH /api/admin/otf/mileage-awards/[id]`). Every field is optional so a
 * caller can change just the label or just the threshold, but the body must
 * carry at least one field — an empty patch is a client bug, not a no-op.
 */
export const OtfMileageAwardUpdateSchema = OtfMileageAwardCreateSchema.partial().refine(
  (patch) => Object.keys(patch).length > 0,
  { message: 'At least one field (label, miles, or color) is required.' },
)

/** Validated update payload inferred from {@link OtfMileageAwardUpdateSchema}. */
export type OtfMileageAwardUpdate = z.infer<typeof OtfMileageAwardUpdateSchema>
