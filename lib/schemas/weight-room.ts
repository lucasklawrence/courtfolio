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

import type { ExerciseGoal, MonthlyFocus, StrengthSet } from '@/types/weight-room'

/**
 * Hex-color regex used for the per-exercise display token. Loose enough
 * to accept the existing palette (`#EA580C`, `#0EA5A1`) without tying
 * the schema to a closed enum — adding a new exercise + color via the
 * settings UI shouldn't require a schema bump.
 */
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * `YYYY-MM-DD` calendar-date regex for the monthly-focus window columns
 * (#255). PostgREST renders a Postgres `date` as this bare string (no
 * time, no zone), so the focus schema validates the shape rather than
 * round-tripping through `Date` (which would reintroduce a UTC-midnight
 * timezone hazard).
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Optional non-negative load in pounds for a set (#255). Accepts a
 * number, `null` (PostgREST emits `null` for bodyweight sets where the
 * column is unset), or absent — normalized to absent by the row
 * converter so {@link StrengthSet.weight_lbs} stays `number | undefined`.
 */
const optionalWeightLbs = () => z.number().nonnegative().nullable().optional()

/**
 * Positive-integer Zod check. Inlined as a `.refine` rather than
 * chaining `.int().positive()` because Turbopack's dev-mode bundler
 * mis-transpiles `z.number().int()` when this module is pulled into a
 * client bundle (the Today View's data island in #80 hit this) — the
 * compiled output references a bare `int` identifier that doesn't
 * exist. The runtime behavior matches `.int().positive()` precisely.
 */
const positiveInt = (): z.ZodType<number> =>
  z
    .number()
    .refine((n) => Number.isInteger(n) && n > 0, 'must be a positive integer')

/**
 * Write-only `exercise` field — non-empty string, lowercased on parse.
 * Used by request-body schemas so direct API consumers (curl,
 * non-Settings clients) can't create case-divergent duplicates that
 * would FK-mismatch between `weight_room_sets.exercise` and
 * `weight_room_goals.exercise`.
 *
 * Deliberately NOT applied to row-shape (read) schemas: a legacy
 * mixed-case row (`"Pushups"`) parsed through a read-side transform
 * would surface in the Settings UI as `"pushups"`, and the next save
 * would POST that lowercase key — Supabase upserts conflict only on
 * exact `exercise`, so it would INSERT a duplicate row instead of
 * UPDATING the original. Read schemas preserve DB casing; writes
 * canonicalize to lowercase going forward (#181, Codex P1 follow-up).
 */
const exerciseWriteField = () =>
  z
    .string()
    .trim()
    .min(1, 'exercise must be non-empty')
    .transform((s) => s.toLowerCase())

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
    reps: positiveInt(),
    weight_lbs: optionalWeightLbs(),
  })
  .strict()

/** Validated `weight_room_sets` row inferred from {@link WeightRoomSetRowSchema}. */
export type WeightRoomSetRow = z.infer<typeof WeightRoomSetRowSchema>

/**
 * Zod schema for one row of `public.weight_room_goals` as read from
 * Supabase. Preserves DB casing exactly — see {@link exerciseWriteField}
 * for why the lowercase transform is write-side only.
 */
export const WeightRoomGoalRowSchema = z
  .object({
    exercise: z.string().min(1),
    daily_target: positiveInt(),
    color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #EA580C'),
    // Optional + nullable so pre-#255 rows (and fixtures) without the
    // column still validate; the DB column is NOT NULL DEFAULT
    // 'permanent', so live rows always carry it. Absent → treated as
    // 'permanent' by the row converter.
    kind: z.enum(['permanent', 'focus']).nullable().optional(),
  })
  .strict()

/** Validated `weight_room_goals` row inferred from {@link WeightRoomGoalRowSchema}. */
export type WeightRoomGoalRow = z.infer<typeof WeightRoomGoalRowSchema>

/**
 * Request-body schema for `POST /api/admin/weight-room/goals`. Same
 * shape as {@link WeightRoomGoalRowSchema} but lowercases `exercise` on
 * parse so direct API consumers can't create case-divergent duplicates
 * of an existing row.
 */
export const WeightRoomGoalUpsertSchema = z
  .object({
    exercise: exerciseWriteField(),
    daily_target: positiveInt(),
    color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #EA580C'),
  })
  .strict()

/** Validated body of `POST /api/admin/weight-room/goals`. */
export type WeightRoomGoalUpsert = z.infer<typeof WeightRoomGoalUpsertSchema>

/**
 * Request-body schema for `POST /api/admin/weight-room/sets`. Accepts
 * the exercise + reps pair; `logged_at` is optional (the API defaults
 * to `now()` when omitted, matching the Today View's "log this set
 * now" UX) and `id` is server-generated.
 */
export const WeightRoomSetCreateSchema = z
  .object({
    exercise: exerciseWriteField(),
    reps: positiveInt(),
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
    // Normalize null/absent to absent so StrengthSet.weight_lbs stays
    // `number | undefined` (bodyweight sets omit the field entirely).
    ...(row.weight_lbs != null ? { weight_lbs: row.weight_lbs } : {}),
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
    // Absent/null → omit so it defaults to 'permanent' at read sites
    // (pre-#255 goals and fixtures never carry kind).
    ...(row.kind != null ? { kind: row.kind } : {}),
  }
}

/**
 * Zod schema for one row of `public.weight_room_monthly_focus` (#255).
 * Mirrors the table in
 * `supabase/migrations/20260628120000_weight_room_monthly_focus.sql`.
 *
 * `start_date` / `end_date` are bare `YYYY-MM-DD` strings (PostgREST's
 * rendering of a Postgres `date`), validated by shape rather than
 * parsed to a `Date` to avoid a UTC-midnight timezone shift.
 */
export const WeightRoomMonthlyFocusRowSchema = z
  .object({
    id: z.string().uuid(),
    exercise: z.string().min(1),
    daily_target: positiveInt(),
    target_kind: z.enum(['reps', 'sets']),
    color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #C9A268'),
    category: z.enum(['upper', 'lower']),
    start_date: z.string().regex(DATE_REGEX, 'start_date must be YYYY-MM-DD'),
    end_date: z.string().regex(DATE_REGEX, 'end_date must be YYYY-MM-DD'),
  })
  .strict()

/** Validated `weight_room_monthly_focus` row inferred from {@link WeightRoomMonthlyFocusRowSchema}. */
export type WeightRoomMonthlyFocusRow = z.infer<typeof WeightRoomMonthlyFocusRowSchema>

/**
 * Request-body schema for the monthly-focus admin route (#255).
 * Lowercases `exercise` (same anti-duplicate reasoning as
 * {@link exerciseWriteField}) and defaults `target_kind` to `'reps'`.
 */
export const WeightRoomMonthlyFocusCreateSchema = z
  .object({
    exercise: exerciseWriteField(),
    daily_target: positiveInt(),
    target_kind: z.enum(['reps', 'sets']).default('reps'),
    color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #C9A268'),
    category: z.enum(['upper', 'lower']),
    start_date: z.string().regex(DATE_REGEX, 'start_date must be YYYY-MM-DD'),
    end_date: z.string().regex(DATE_REGEX, 'end_date must be YYYY-MM-DD'),
  })
  .strict()
  .refine((v) => v.end_date >= v.start_date, {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  })

/** Validated body of the monthly-focus admin route. */
export type WeightRoomMonthlyFocusCreate = z.infer<typeof WeightRoomMonthlyFocusCreateSchema>

/**
 * Translate a validated `weight_room_monthly_focus` row into the public
 * {@link MonthlyFocus} shape. Pass-through; sibling-symmetric with
 * {@link setRowToStrengthSet} / {@link goalRowToExerciseGoal}.
 */
export function focusRowToMonthlyFocus(row: WeightRoomMonthlyFocusRow): MonthlyFocus {
  return {
    id: row.id,
    exercise: row.exercise,
    daily_target: row.daily_target,
    target_kind: row.target_kind,
    color: row.color,
    category: row.category,
    start_date: row.start_date,
    end_date: row.end_date,
  }
}
