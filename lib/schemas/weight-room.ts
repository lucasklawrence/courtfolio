/**
 * Pure (isomorphic) Zod schemas for the Weight Room Supabase row contract
 * (#79). Used by the data layer (`lib/data/weight-room*.ts`) on read and
 * by the admin write API routes (`app/api/admin/weight-room/*`) on write.
 *
 * Sibling pattern: `lib/schemas/cardio.ts`, `lib/schemas/movement.ts`.
 *
 * The static {@link import('@/types/weight-room').WeightRoomData} types
 * mirror these schemas for IDE ergonomics — when the schema changes,
 * update the static types so component-side `Cmd+hover` stays accurate.
 */

import { z } from 'zod'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/**
 * Hex-color regex used for the per-exercise display token. Loose enough
 * to accept the existing palette (`#EA580C`, `#0EA5A1`) without tying
 * the schema to a closed enum — adding a new exercise + color via the
 * settings UI shouldn't require a schema bump.
 */
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Zod schema for one row of `public.weight_room_sets`. Mirrors the
 * table definition in
 * `supabase/migrations/20260507120000_weight_room_tables.sql`.
 *
 * `id` is a UUID generated server-side; the API never accepts a
 * client-supplied id. `logged_at` is an ISO timestamp string from the
 * `timestamptz` column. `reps` is a positive integer.
 */
export const WeightRoomSetRowSchema = z
  .object({
    id: z.string().uuid(),
    logged_at: z.string().min(1, 'logged_at must be an ISO timestamp'),
    exercise: z.string().min(1),
    reps: z.number().int().positive(),
  })
  .strict()

/** Validated `weight_room_sets` row inferred from {@link WeightRoomSetRowSchema}. */
export type WeightRoomSetRow = z.infer<typeof WeightRoomSetRowSchema>

/**
 * Zod schema for one row of `public.weight_room_goals`. Settings UI
 * upserts via `POST /api/admin/weight-room/goals`; the row schema
 * doubles as the request-body validator there.
 */
export const WeightRoomGoalRowSchema = z
  .object({
    exercise: z.string().min(1),
    daily_target: z.number().int().positive(),
    color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #EA580C'),
  })
  .strict()

/** Validated `weight_room_goals` row inferred from {@link WeightRoomGoalRowSchema}. */
export type WeightRoomGoalRow = z.infer<typeof WeightRoomGoalRowSchema>

/**
 * Request-body schema for `POST /api/admin/weight-room/sets`. Accepts
 * the exercise + reps pair; `logged_at` is optional (the API defaults
 * to `now()` when omitted, matching the Today View's "log this set
 * now" UX) and `id` is server-generated.
 */
export const WeightRoomSetCreateSchema = z
  .object({
    exercise: z.string().min(1),
    reps: z.number().int().positive(),
    logged_at: z.string().min(1).optional(),
  })
  .strict()

/** Validated body of `POST /api/admin/weight-room/sets`. */
export type WeightRoomSetCreate = z.infer<typeof WeightRoomSetCreateSchema>

/**
 * Translate a validated `weight_room_sets` row into the public
 * {@link StrengthSet} shape. Trivial pass-through right now, but
 * sibling-symmetric with `sessionRowToCardioSession` so future shape
 * divergence (e.g. computed fields) has a natural home.
 */
export function setRowToStrengthSet(row: WeightRoomSetRow): StrengthSet {
  return {
    id: row.id,
    logged_at: row.logged_at,
    exercise: row.exercise,
    reps: row.reps,
  }
}

/**
 * Translate a validated `weight_room_goals` row into the public
 * {@link ExerciseGoal} shape. Pass-through; same reasoning as
 * {@link setRowToStrengthSet}.
 */
export function goalRowToExerciseGoal(row: WeightRoomGoalRow): ExerciseGoal {
  return {
    exercise: row.exercise,
    daily_target: row.daily_target,
    color: row.color,
  }
}
