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

import type {
  AchievementMeasure,
  AchievementScope,
  ExerciseEquipment,
  ExerciseGoal,
  ExerciseMuscleGroup,
  MonthlyFocus,
  StrengthSet,
  TemplateAlternate,
  TemplateCategory,
  TemplateSlot,
  TemplateSlotStep,
  WeightRoomAchievement,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutLocation,
  WorkoutPrescription,
  WorkoutTemplate,
} from '@/types/weight-room'

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
  z.number().refine(n => Number.isInteger(n) && n > 0, 'must be a positive integer')

/**
 * Non-negative-integer Zod check, for `position` (#374) — set order within a
 * workout, which is 0-based. Same inlined-`.refine` reasoning as
 * {@link positiveInt}: the Turbopack dev bundler mis-transpiles
 * `z.number().int()` when this module is pulled into a client bundle.
 */
const nonNegativeInt = (): z.ZodType<number> =>
  z.number().refine(n => Number.isInteger(n) && n >= 0, 'must be a non-negative integer')

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
    .transform(s => s.toLowerCase())

/**
 * Write-only `variant` field (#254) — the optional grip / width / tempo
 * for a logged set. Accepts a string, `null`, or absent; trims and
 * lowercases a provided value, and normalizes empty / whitespace-only /
 * null / absent all to `undefined` (the API omits the column, so the DB
 * stores `null` = "unspecified").
 *
 * Lowercasing mirrors {@link exerciseWriteField}'s anti-duplicate intent:
 * the History View buckets an exercise's volume by exact variant string,
 * so `"Wide"` and `"wide"` logged on different days must collapse to one
 * bucket rather than reading as two grips. Read schemas preserve DB
 * casing; writes canonicalize going forward.
 */
const variantWriteField = () =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform(v => {
      if (v == null) return undefined
      const normalized = v.trim().toLowerCase()
      return normalized === '' ? undefined : normalized
    })

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
    // Optional + nullable so pre-#254 rows (and fixtures) without the
    // column still validate; PostgREST emits `null` for unspecified
    // sets. Casing preserved on read (writes lowercase it) — see
    // {@link variantWriteField}. Normalized to absent by the row
    // converter so {@link StrengthSet.variant} stays `string | undefined`.
    variant: z.string().nullable().optional(),
    // Session membership (#374). Null is the overwhelming majority — every
    // grease-the-groove set ever logged — and means "loose", not "missing".
    workout_id: z.string().uuid().nullable().optional(),
    position: nonNegativeInt().nullable().optional(),
    template_slot_id: z.string().uuid().nullable().optional(),
    template_slot_step_id: z.string().uuid().nullable().optional(),
  })
  .strict()

/** Validated `weight_room_sets` row inferred from {@link WeightRoomSetRowSchema}. */
export type WeightRoomSetRow = z.infer<typeof WeightRoomSetRowSchema>

/**
 * Zod schema for one row of `public.weight_room_goals` as read from
 * Supabase. Preserves DB casing exactly — see {@link exerciseWriteField}
 * for why the lowercase transform is write-side only.
 *
 * No `load_multiplier` as of #373: it moved to `weight_room_exercises`, and the
 * data layer joins it onto {@link ExerciseGoal} after conversion. The goals
 * column is no longer selected (a follow-up drops it once this deploys).
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
 * Zod schema for one row of `public.weight_room_goal_targets` (#362).
 * Mirrors the table in
 * `supabase/migrations/20260730120000_weight_room_goal_targets.sql`.
 *
 * `effective_from` is a bare `YYYY-MM-DD` string (PostgREST's rendering of a
 * Postgres `date`), validated by shape rather than parsed to a `Date` — the
 * resolution helpers compare these keys lexicographically, so parsing would
 * only introduce the UTC-midnight shift they exist to avoid.
 */
export const WeightRoomGoalTargetRowSchema = z
  .object({
    id: z.string().uuid(),
    exercise: z.string().min(1),
    daily_target: positiveInt(),
    effective_from: z.string().regex(DATE_REGEX, 'effective_from must be YYYY-MM-DD'),
  })
  .strict()

/** Validated `weight_room_goal_targets` row inferred from {@link WeightRoomGoalTargetRowSchema}. */
export type WeightRoomGoalTargetRow = z.infer<typeof WeightRoomGoalTargetRowSchema>

/**
 * Request-body schema for `POST /api/admin/weight-room/goals`. Same
 * shape as {@link WeightRoomGoalRowSchema} but lowercases `exercise` on
 * parse so direct API consumers can't create case-divergent duplicates
 * of an existing row.
 *
 * `effective_from` (#362) declares the day the supplied `daily_target` takes
 * effect. Optional — omitted means "from today" — and backdatable, so a
 * target change can be recorded after the fact against the day it really
 * started. It only matters when `daily_target` actually changes; a
 * colour-only edit appends no history row.
 */
export const WeightRoomGoalUpsertSchema = z
  .object({
    exercise: exerciseWriteField(),
    daily_target: positiveInt(),
    color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #EA580C'),
    effective_from: z.string().regex(DATE_REGEX, 'effective_from must be YYYY-MM-DD').optional(),
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
    // Optional grip / width / tempo (#254). Lowercased + trimmed;
    // empty / whitespace / null all normalize to `undefined` so the
    // route omits the column and the DB stores `null` (unspecified).
    variant: variantWriteField(),
    // External load in pounds, per implement (#376). This was missing until
    // now, which meant weighted sets could not be logged through the app at
    // all — every one on the site got there via the log-workout skill writing
    // raw SQL and bypassing this schema entirely.
    weight_lbs: z.number().nonnegative().optional(),
    // Session membership (#374). Explicit only — the route never infers it
    // from whichever workout happens to be open, so a desk pushup set can't
    // silently join the morning's gym session.
    workout_id: z.string().uuid().optional(),
    position: nonNegativeInt().optional(),
    // The template slot this set was performed for (#376). A set whose
    // `exercise` differs from its slot's is a substitution, recorded by that
    // difference rather than by a flag.
    template_slot_id: z.string().uuid().optional(),
    // The within-set step (#407) — one rung of a drop set, one movement of a
    // superset. Only meaningful alongside `template_slot_id`; see the refine
    // below, which rejects a step with no slot rather than storing a set that
    // claims to belong to a sequence in no slot.
    template_slot_step_id: z.string().uuid().optional(),
  })
  // `.strict()` before `.refine()`, not after: refine returns an effects
  // wrapper, and chaining strict onto that is at best ambiguous — the
  // unknown-key rejection this file relies on everywhere must be applied to the
  // object itself.
  .strict()
  .refine(body => body.template_slot_step_id === undefined || body.template_slot_id !== undefined, {
    message: 'template_slot_step_id requires template_slot_id — a step belongs to a slot.',
    path: ['template_slot_step_id'],
  })

/** Validated body of `POST /api/admin/weight-room/sets`. */
export type WeightRoomSetCreate = z.infer<typeof WeightRoomSetCreateSchema>

/**
 * Request-body schema for `PATCH /api/admin/weight-room/sets/[id]` (#376).
 *
 * Correcting a mistyped set previously meant deleting it and re-entering —
 * which loses its `logged_at` and, inside a workout, its place in the order.
 * Every field optional, at least one required.
 *
 * `weight_lbs` and `variant` accept an explicit `null` to *clear* them: a set
 * logged as weighted by mistake has to be able to become a bodyweight set
 * again, which an omitted key can't express under PATCH semantics.
 */
export const WeightRoomSetUpdateSchema = z
  .object({
    exercise: exerciseWriteField(),
    reps: positiveInt(),
    logged_at: z.string().min(1),
    weight_lbs: z.number().nonnegative().nullable(),
    variant: z.union([z.string(), z.null()]).transform(v => {
      if (v === null) return null
      const trimmed = v.trim().toLowerCase()
      return trimmed === '' ? null : trimmed
    }),
  })
  .strict()
  .partial()
  .refine(patch => Object.values(patch).some(v => v !== undefined), {
    message: 'At least one field (exercise, reps, logged_at, weight_lbs, or variant) is required.',
  })

/** Validated body of `PATCH /api/admin/weight-room/sets/[id]`. */
export type WeightRoomSetUpdate = z.infer<typeof WeightRoomSetUpdateSchema>

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
    // Same normalization for variant (#254): null / absent / empty all
    // collapse to absent so an unspecified set never surfaces a phantom
    // "" variant bucket in the History View breakdown.
    ...(row.variant != null && row.variant !== '' ? { variant: row.variant } : {}),
    // Session membership (#374); same absent-not-null treatment.
    ...(row.workout_id != null ? { workout_id: row.workout_id } : {}),
    ...(row.position != null ? { position: row.position } : {}),
    ...(row.template_slot_id != null ? { template_slot_id: row.template_slot_id } : {}),
    ...(row.template_slot_step_id != null
      ? { template_slot_step_id: row.template_slot_step_id }
      : {}),
  }
}

/** Workout locations, as a Zod enum reused by the row + write schemas (#374). */
const workoutLocation = (): z.ZodType<WorkoutLocation> => z.enum(['gym', 'home', 'travel', 'other'])

/**
 * Zod schema for one slot inside a frozen {@link WorkoutPrescriptionSchema}
 * (#377).
 *
 * `.strict()` like every other row schema here, and for the same reason: this
 * is stored jsonb, so nothing but the database validates it. A field quietly
 * added to `TemplateSlot` and written into a snapshot without being added here
 * would fail loudly on the next read rather than being silently dropped.
 */
export const PrescribedSlotSchema = z
  .object({
    id: z.string().uuid(),
    position: z.number().int().nonnegative(),
    exercise: z.string().min(1),
    target_sets: z.number().int().positive(),
    target_sets_max: z.number().int().positive().optional(),
    target_reps: z.number().int().positive().optional(),
    target_reps_max: z.number().int().positive().optional(),
    target_weight_lbs: z.number().positive().optional(),
    notes: z.string().optional(),
  })
  .strict()

/**
 * Zod schema for `weight_room_workouts.prescription` (#377) — a session's
 * frozen copy of what its template prescribed at start.
 *
 * See {@link WeightRoomWorkout.prescription} for why the snapshot exists.
 */
export const WorkoutPrescriptionSchema = z
  .object({
    template_id: z.string().uuid(),
    name: z.string().min(1),
    slots: z.array(PrescribedSlotSchema),
  })
  .strict()

/**
 * Freeze a live template into the snapshot stored on a starting session (#377).
 *
 * Slots are sorted by `position` here rather than trusted from the caller, so
 * the snapshot's order is the prescription's order regardless of how the
 * template was loaded. `steps` and `alternates` are dropped — see
 * {@link PrescribedSlot}.
 *
 * @param template The template the session is starting against.
 */
export function templateToPrescription(template: WorkoutTemplate): WorkoutPrescription {
  return {
    template_id: template.id,
    name: template.name,
    slots: [...template.slots]
      .sort((a, b) => a.position - b.position)
      .map(slot => ({
        id: slot.id,
        position: slot.position,
        exercise: slot.exercise,
        target_sets: slot.target_sets,
        ...(slot.target_sets_max !== undefined ? { target_sets_max: slot.target_sets_max } : {}),
        ...(slot.target_reps !== undefined ? { target_reps: slot.target_reps } : {}),
        ...(slot.target_reps_max !== undefined ? { target_reps_max: slot.target_reps_max } : {}),
        ...(slot.target_weight_lbs !== undefined
          ? { target_weight_lbs: slot.target_weight_lbs }
          : {}),
        ...(slot.notes !== undefined ? { notes: slot.notes } : {}),
      })),
  }
}

/**
 * Rehydrate a frozen prescription into the {@link WorkoutTemplate} shape the
 * adherence math already consumes (#377).
 *
 * Returning a full template rather than widening `buildWorkoutAdherence` to a
 * narrower structural type keeps **one** scoring path for live sessions and
 * historical ones — two would be free to drift, which is exactly the class of
 * bug this snapshot exists to prevent.
 *
 * `steps` and `alternates` come back empty because they were never captured;
 * neither participates in adherence.
 *
 * @param prescription The snapshot from `weight_room_workouts.prescription`.
 */
export function prescriptionToTemplate(prescription: WorkoutPrescription): WorkoutTemplate {
  return {
    id: prescription.template_id,
    name: prescription.name,
    position: 0,
    slots: prescription.slots.map(slot => ({ ...slot, steps: [], alternates: [] })),
  }
}

/**
 * Zod schema for one row of `public.weight_room_workouts` (#374). Mirrors the
 * table in `supabase/migrations/20260802120000_weight_room_workouts.sql`.
 *
 * `ended_at` nullable is load-bearing rather than lenient: `null` *means* "in
 * progress", so it can't be collapsed to absent the way a merely-unsupplied
 * field would be — same reasoning the achievements schema documents for its
 * pooled `exercise`.
 */
export const WeightRoomWorkoutRowSchema = z
  .object({
    id: z.string().uuid(),
    started_at: z.string().min(1, 'started_at must be an ISO timestamp'),
    ended_at: z.string().nullable().optional(),
    template_id: z.string().uuid().nullable().optional(),
    source: z.enum(['manual', 'apple_health']).nullable().optional(),
    avg_hr: z.number().nullable().optional(),
    max_hr: z.number().nullable().optional(),
    prescription: WorkoutPrescriptionSchema.nullable().optional(),
    title: z.string().nullable().optional(),
    location: workoutLocation().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

/** Validated `weight_room_workouts` row inferred from {@link WeightRoomWorkoutRowSchema}. */
export type WeightRoomWorkoutRow = z.infer<typeof WeightRoomWorkoutRowSchema>

/**
 * Translate a validated `weight_room_workouts` row into the public
 * {@link WeightRoomWorkout} shape. Null optionals are omitted so each stays
 * `T | undefined`; an absent `ended_at` is what every read site tests for to
 * mean "in progress".
 */
export function workoutRowToWeightRoomWorkout(row: WeightRoomWorkoutRow): WeightRoomWorkout {
  return {
    id: row.id,
    started_at: row.started_at,
    ...(row.ended_at != null ? { ended_at: row.ended_at } : {}),
    ...(row.template_id != null ? { template_id: row.template_id } : {}),
    // `'manual'` is the column default and the absent-field meaning, so it's
    // omitted rather than carried — every read site treats absent as manual.
    ...(row.source != null && row.source !== 'manual' ? { source: row.source } : {}),
    ...(row.avg_hr != null ? { avg_hr: row.avg_hr } : {}),
    ...(row.max_hr != null ? { max_hr: row.max_hr } : {}),
    ...(row.prescription != null ? { prescription: row.prescription } : {}),
    ...(row.title != null && row.title !== '' ? { title: row.title } : {}),
    ...(row.location != null ? { location: row.location } : {}),
    ...(row.notes != null && row.notes !== '' ? { notes: row.notes } : {}),
  }
}

/**
 * Free-text write field shared by `title` and `notes` — trims, and normalizes
 * empty / whitespace-only / `null` / absent all to `undefined` so the route
 * omits the column and the DB keeps its `null` default rather than storing an
 * empty string the read side would have to special-case. Mirrors
 * {@link variantWriteField} minus the lowercasing (these are prose, not keys).
 */
const optionalTextField = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform(v => {
      if (v == null) return undefined
      const trimmed = v.trim()
      return trimmed === '' ? undefined : trimmed
    })
    .refine(v => v === undefined || v.length <= max, `must be ${max} characters or fewer`)

/**
 * Free-text **patch** field — same trimming as {@link optionalTextField}, but
 * empty / whitespace-only / `null` all normalize to **`null`**, not `undefined`.
 *
 * The distinction is the whole point of PATCH semantics. On create, "" means
 * "I didn't supply one", so omitting the column and letting the DB default to
 * null is right. On update, clearing the field in an editor and saving means
 * "remove the title I set earlier" — collapsing that to `undefined` would make
 * the write a silent no-op and the title would stubbornly persist. Only an
 * *absent* key means "leave this alone".
 */
const clearableTextField = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform(v => {
      if (v === undefined) return undefined
      if (v === null) return null
      const trimmed = v.trim()
      return trimmed === '' ? null : trimmed
    })
    .refine(v => v == null || v.length <= max, `must be ${max} characters or fewer`)

/**
 * Request-body schema for `POST /api/admin/weight-room/workouts` (#374) — start
 * a session.
 *
 * Every field is optional: the common case is tapping "start" and getting a
 * session stamped `now()`. `started_at` is accepted so a workout can be
 * reconstructed after the fact, and `ended_at` alongside it so a whole finished
 * session can be recorded in one call — which is how the `log-workout` skill
 * (#378) will narrate a workout that already happened.
 */
export const WeightRoomWorkoutCreateSchema = z
  .object({
    started_at: z.string().min(1).optional(),
    ended_at: z.string().min(1).optional(),
    // Which template this session runs (#376), by id — never by title, which
    // is free text and not unique across templates.
    template_id: z.string().uuid().optional(),
    title: optionalTextField(80),
    location: workoutLocation().optional(),
    notes: optionalTextField(2000),
  })
  .strict()

/** Validated body of `POST /api/admin/weight-room/workouts`. */
export type WeightRoomWorkoutCreate = z.infer<typeof WeightRoomWorkoutCreateSchema>

/**
 * Request-body schema for `PATCH /api/admin/weight-room/workouts/[id]` (#374).
 *
 * `ended_at` accepts an explicit `null` to *reopen* a session — the one case
 * where a null is a value rather than an omission, and the reason this can't be
 * a `.partial()` of the create schema. Every field optional, at least one
 * required; an empty patch is a client bug, not a no-op.
 */
export const WeightRoomWorkoutUpdateSchema = z
  .object({
    ended_at: z.union([z.string().min(1), z.null()]).optional(),
    title: clearableTextField(80),
    location: z.union([workoutLocation(), z.null()]).optional(),
    notes: clearableTextField(2000),
  })
  .strict()
  .refine(patch => Object.values(patch).some(v => v !== undefined), {
    message: 'At least one field (ended_at, title, location, or notes) is required.',
  })

/** Validated body of `PATCH /api/admin/weight-room/workouts/[id]`. */
export type WeightRoomWorkoutUpdate = z.infer<typeof WeightRoomWorkoutUpdateSchema>

/** The seven template categories, as a Zod enum reused by the row + write schemas (#375). */
const templateCategory = (): z.ZodType<TemplateCategory> =>
  z.enum(['push', 'pull', 'legs', 'upper', 'lower', 'full-body', 'other'])

/**
 * Zod schema for one row of `public.weight_room_workout_templates` (#375).
 * Mirrors `supabase/migrations/20260803120000_weight_room_workout_templates.sql`.
 */
export const WeightRoomWorkoutTemplateRowSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    category: templateCategory().nullable().optional(),
    position: nonNegativeInt(),
    archived: z.boolean().nullable().optional(),
  })
  .strict()

/** Validated `weight_room_workout_templates` row. */
export type WeightRoomWorkoutTemplateRow = z.infer<typeof WeightRoomWorkoutTemplateRowSchema>

/**
 * Zod schema for one row of `public.weight_room_template_slots` (#375).
 *
 * `target_reps` absent is meaningful — AMRAP, or "sets prescribed, reps not" —
 * so it is never defaulted to a number.
 */
export const WeightRoomTemplateSlotRowSchema = z
  .object({
    id: z.string().uuid(),
    template_id: z.string().uuid(),
    position: nonNegativeInt(),
    exercise: z.string().min(1),
    target_sets: positiveInt(),
    target_sets_max: positiveInt().nullable().optional(),
    target_reps: positiveInt().nullable().optional(),
    target_reps_max: positiveInt().nullable().optional(),
    target_weight_lbs: z.number().nonnegative().nullable().optional(),
    rest_seconds: nonNegativeInt().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

/** Validated `weight_room_template_slots` row. */
export type WeightRoomTemplateSlotRow = z.infer<typeof WeightRoomTemplateSlotRowSchema>

/**
 * Zod schema for one row of `public.weight_room_template_slot_steps` (#375).
 * `exercise` nullable is the drop-set / superset distinction — see
 * {@link import('@/types/weight-room').TemplateSlotStep}.
 */
export const WeightRoomTemplateSlotStepRowSchema = z
  .object({
    id: z.string().uuid(),
    slot_id: z.string().uuid(),
    position: nonNegativeInt(),
    exercise: z.string().min(1).nullable().optional(),
    target_reps: positiveInt().nullable().optional(),
    target_weight_lbs: z.number().nonnegative().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

/** Validated `weight_room_template_slot_steps` row. */
export type WeightRoomTemplateSlotStepRow = z.infer<typeof WeightRoomTemplateSlotStepRowSchema>

/** Zod schema for one row of `public.weight_room_template_alternates` (#375). */
export const WeightRoomTemplateAlternateRowSchema = z
  .object({
    id: z.string().uuid(),
    slot_id: z.string().uuid(),
    position: nonNegativeInt(),
    exercise: z.string().min(1),
  })
  .strict()

/** Validated `weight_room_template_alternates` row. */
export type WeightRoomTemplateAlternateRow = z.infer<typeof WeightRoomTemplateAlternateRowSchema>

/**
 * Assemble validated template / slot / step / alternate rows into the nested
 * {@link WorkoutTemplate} shape, ordered by `position` at every level.
 *
 * Done here rather than with a PostgREST embedded select so the four row
 * schemas stay flat and independently `.strict()` — an embed returns a nested
 * object that no single row schema can validate, which is how a column added
 * to one of these tables would slip past validation unnoticed.
 *
 * @param templates Template rows.
 * @param slots Slot rows across all templates.
 * @param steps Step rows across all slots.
 * @param alternates Alternate rows across all slots.
 */
export function assembleWorkoutTemplates(
  templates: readonly WeightRoomWorkoutTemplateRow[],
  slots: readonly WeightRoomTemplateSlotRow[],
  steps: readonly WeightRoomTemplateSlotStepRow[],
  alternates: readonly WeightRoomTemplateAlternateRow[]
): WorkoutTemplate[] {
  const stepsBySlot = new Map<string, TemplateSlotStep[]>()
  for (const row of [...steps].sort((a, b) => a.position - b.position)) {
    const list = stepsBySlot.get(row.slot_id) ?? []
    list.push({
      id: row.id,
      position: row.position,
      ...(row.exercise != null ? { exercise: row.exercise } : {}),
      ...(row.target_reps != null ? { target_reps: row.target_reps } : {}),
      ...(row.target_weight_lbs != null ? { target_weight_lbs: row.target_weight_lbs } : {}),
      ...(row.notes != null && row.notes !== '' ? { notes: row.notes } : {}),
    })
    stepsBySlot.set(row.slot_id, list)
  }

  const alternatesBySlot = new Map<string, TemplateAlternate[]>()
  for (const row of [...alternates].sort((a, b) => a.position - b.position)) {
    const list = alternatesBySlot.get(row.slot_id) ?? []
    list.push({ id: row.id, exercise: row.exercise, position: row.position })
    alternatesBySlot.set(row.slot_id, list)
  }

  const slotsByTemplate = new Map<string, TemplateSlot[]>()
  for (const row of [...slots].sort((a, b) => a.position - b.position)) {
    const list = slotsByTemplate.get(row.template_id) ?? []
    list.push({
      id: row.id,
      position: row.position,
      exercise: row.exercise,
      target_sets: row.target_sets,
      ...(row.target_sets_max != null ? { target_sets_max: row.target_sets_max } : {}),
      ...(row.target_reps != null ? { target_reps: row.target_reps } : {}),
      ...(row.target_reps_max != null ? { target_reps_max: row.target_reps_max } : {}),
      ...(row.target_weight_lbs != null ? { target_weight_lbs: row.target_weight_lbs } : {}),
      ...(row.rest_seconds != null ? { rest_seconds: row.rest_seconds } : {}),
      ...(row.notes != null && row.notes !== '' ? { notes: row.notes } : {}),
      steps: stepsBySlot.get(row.id) ?? [],
      alternates: alternatesBySlot.get(row.id) ?? [],
    })
    slotsByTemplate.set(row.template_id, list)
  }

  return [...templates]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map(row => ({
      id: row.id,
      name: row.name,
      position: row.position,
      ...(row.description != null && row.description !== ''
        ? { description: row.description }
        : {}),
      ...(row.color != null ? { color: row.color } : {}),
      ...(row.category != null ? { category: row.category } : {}),
      ...(row.archived != null ? { archived: row.archived } : {}),
      slots: slotsByTemplate.get(row.id) ?? [],
    }))
}

/**
 * The template write fields, without any `.default()` — see
 * {@link achievementWriteFields} for why deriving a PATCH schema from a
 * defaulted create schema silently resets omitted keys.
 */
const templateWriteFields = {
  name: z.string().trim().min(1, 'name is required').max(80, 'name is too long'),
  description: clearableTextField(2000),
  color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #DC2626').nullable(),
  category: templateCategory().nullable(),
  position: nonNegativeInt(),
  archived: z.boolean(),
}

/** Request-body schema for `POST /api/admin/weight-room/templates` (#375). */
export const WeightRoomTemplateCreateSchema = z
  .object({
    ...templateWriteFields,
    description: templateWriteFields.description,
    color: templateWriteFields.color.optional(),
    category: templateWriteFields.category.optional(),
    position: templateWriteFields.position.default(0),
    archived: templateWriteFields.archived.default(false),
  })
  .strict()

/** Validated body of `POST /api/admin/weight-room/templates`. */
export type WeightRoomTemplateCreate = z.infer<typeof WeightRoomTemplateCreateSchema>

/**
 * Request-body schema for `PATCH /api/admin/weight-room/templates/[id]` (#375).
 * Every field optional, at least one required.
 */
export const WeightRoomTemplateUpdateSchema = z
  .object(templateWriteFields)
  .strict()
  .partial()
  .refine(patch => Object.values(patch).some(v => v !== undefined), {
    message: 'At least one field is required.',
  })

/** Validated body of `PATCH /api/admin/weight-room/templates/[id]`. */
export type WeightRoomTemplateUpdate = z.infer<typeof WeightRoomTemplateUpdateSchema>

/**
 * One step in a slot write body. Steps carry no external references, so a slot
 * write replaces them wholesale rather than editing them individually — unlike
 * slots themselves, whose ids #376 links logged sets to.
 */
const slotStepWriteSchema = z
  .object({
    exercise: exerciseWriteField().nullable().optional(),
    target_reps: positiveInt().optional(),
    target_weight_lbs: z.number().nonnegative().optional(),
    notes: clearableTextField(200),
  })
  .strict()

/** The slot write fields, default-free for the same reason as the template ones. */
const slotWriteFields = {
  exercise: exerciseWriteField(),
  target_sets: positiveInt(),
  target_sets_max: positiveInt().nullable(),
  target_reps: positiveInt().nullable(),
  target_reps_max: positiveInt().nullable(),
  target_weight_lbs: z.number().nonnegative().nullable(),
  rest_seconds: nonNegativeInt().nullable(),
  notes: clearableTextField(500),
  /** Full replacement of this slot's within-set sequence. */
  steps: z.array(slotStepWriteSchema).max(20),
  /** Full replacement of this slot's pre-declared swaps, in array order. */
  alternates: z.array(exerciseWriteField()).max(20),
}

/**
 * Shape the two range refinements inspect. Both schemas below are `.partial()`
 * or optional-heavy, so every field may be absent.
 */
interface SlotRangeFields {
  target_sets?: number | null
  target_sets_max?: number | null
  target_reps?: number | null
  target_reps_max?: number | null
}

/**
 * A set range's top must not sit below its floor.
 *
 * On a partial patch `target_sets` may be absent while `target_sets_max` is
 * supplied; that can't be validated in isolation, so it passes here and the
 * table's CHECK backstops it against the stored floor.
 */
function setRangeIsOrdered(v: SlotRangeFields): boolean {
  return v.target_sets_max == null || v.target_sets == null || v.target_sets_max >= v.target_sets
}

/**
 * A rep-range top is meaningless without a floor to range from, and must not
 * sit below it. Unlike sets, `target_reps` absent *with* a max supplied is
 * always wrong — absent reps means AMRAP, which has no range.
 */
function repRangeIsOrdered(v: SlotRangeFields): boolean {
  return v.target_reps_max == null || (v.target_reps != null && v.target_reps_max >= v.target_reps)
}

/** Request-body schema for `POST /api/admin/weight-room/templates/[id]/slots` (#375). */
export const WeightRoomTemplateSlotCreateSchema = z
  .object({
    ...slotWriteFields,
    target_sets_max: slotWriteFields.target_sets_max.optional(),
    target_reps: slotWriteFields.target_reps.optional(),
    target_reps_max: slotWriteFields.target_reps_max.optional(),
    target_weight_lbs: slotWriteFields.target_weight_lbs.optional(),
    rest_seconds: slotWriteFields.rest_seconds.optional(),
    steps: slotWriteFields.steps.default([]),
    alternates: slotWriteFields.alternates.default([]),
  })
  .strict()
  .refine(setRangeIsOrdered, {
    message: 'target_sets_max must be at least target_sets',
    path: ['target_sets_max'],
  })
  .refine(repRangeIsOrdered, {
    message: 'target_reps_max requires target_reps and must be at least it',
    path: ['target_reps_max'],
  })

/** Validated body of the slot-create route. */
export type WeightRoomTemplateSlotCreate = z.infer<typeof WeightRoomTemplateSlotCreateSchema>

/**
 * Request-body schema for
 * `PATCH /api/admin/weight-room/templates/[id]/slots/[slotId]` (#375).
 *
 * Omitting `steps` or `alternates` leaves them untouched; supplying either
 * replaces that slot's list wholesale.
 */
export const WeightRoomTemplateSlotUpdateSchema = z
  .object(slotWriteFields)
  .strict()
  .partial()
  .refine(patch => Object.values(patch).some(v => v !== undefined), {
    message: 'At least one field is required.',
  })
  .refine(setRangeIsOrdered, {
    message: 'target_sets_max must be at least target_sets',
    path: ['target_sets_max'],
  })
  .refine(repRangeIsOrdered, {
    message: 'target_reps_max requires target_reps and must be at least it',
    path: ['target_reps_max'],
  })

/** Validated body of the slot-update route. */
export type WeightRoomTemplateSlotUpdate = z.infer<typeof WeightRoomTemplateSlotUpdateSchema>

/**
 * Request-body schema for reordering a template's slots — an array of
 * `{ id, position }` applied in one upsert.
 *
 * The table's `(template_id, position)` unique constraint is DEFERRABLE, so a
 * swap that transiently duplicates a position is legal until commit. An
 * immediate constraint would reject the first half of every swap.
 */
export const WeightRoomTemplateSlotReorderSchema = z
  .object({
    order: z
      .array(z.object({ id: z.string().uuid(), position: nonNegativeInt() }).strict())
      .min(1, 'order must list at least one slot'),
  })
  .strict()

/** Validated body of the slot-reorder route. */
export type WeightRoomTemplateSlotReorder = z.infer<typeof WeightRoomTemplateSlotReorderSchema>

/**
 * Translate a validated `weight_room_goals` row into the public
 * {@link ExerciseGoal} shape. Pass-through; same reasoning as
 * {@link setRowToStrengthSet}.
 *
 * `load_multiplier` is deliberately *not* set here — it lives on the catalog as
 * of #373, and the data layer attaches it from `weight_room_exercises` after
 * this conversion. A goal converted in isolation therefore has it absent, which
 * every read site already treats as `1`.
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

/** The eight equipment kinds, as a Zod enum reused by the row + write schemas. */
const exerciseEquipment = (): z.ZodType<ExerciseEquipment> =>
  z.enum(['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'band', 'bodyweight', 'other'])

/** The seven coarse muscle groups, as a Zod enum reused by the row + write schemas. */
const exerciseMuscleGroup = (): z.ZodType<ExerciseMuscleGroup> =>
  z.enum(['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full-body'])

/**
 * Zod schema for one row of `public.weight_room_exercises` (#373) — the
 * movement roster. Mirrors the table in
 * `supabase/migrations/20260731120000_weight_room_exercises_catalog.sql`.
 *
 * `slug` preserves DB casing on read for the same reason every sibling row
 * schema does (see {@link exerciseWriteField}); writes lowercase it.
 * `load_multiplier` / `is_unilateral` / `archived` are `.nullable().optional()`
 * so a fixture omitting them still validates, even though the live columns are
 * all `NOT NULL DEFAULT`.
 */
export const WeightRoomExerciseRowSchema = z
  .object({
    slug: z.string().min(1),
    display_name: z.string().min(1),
    equipment: exerciseEquipment(),
    muscle_group: exerciseMuscleGroup(),
    load_multiplier: positiveInt().nullable().optional(),
    is_unilateral: z.boolean().nullable().optional(),
    archived: z.boolean().nullable().optional(),
  })
  .strict()

/** Validated `weight_room_exercises` row inferred from {@link WeightRoomExerciseRowSchema}. */
export type WeightRoomExerciseRow = z.infer<typeof WeightRoomExerciseRowSchema>

/**
 * Translate a validated `weight_room_exercises` row into the public
 * {@link WeightRoomExercise} shape. Null/absent optionals are omitted so the
 * consumed type stays `number | undefined` / `boolean | undefined` and read
 * sites can apply their documented defaults (1 / false / false).
 */
export function exerciseRowToWeightRoomExercise(row: WeightRoomExerciseRow): WeightRoomExercise {
  return {
    slug: row.slug,
    display_name: row.display_name,
    equipment: row.equipment,
    muscle_group: row.muscle_group,
    ...(row.load_multiplier != null ? { load_multiplier: row.load_multiplier } : {}),
    ...(row.is_unilateral != null ? { is_unilateral: row.is_unilateral } : {}),
    ...(row.archived != null ? { archived: row.archived } : {}),
  }
}

/**
 * The catalog write fields, without any `.default()`.
 *
 * Kept default-free so {@link WeightRoomExerciseUpdateSchema} can be derived
 * from it safely — Zod 4 applies `.default()` to a missing key even inside
 * `.partial()`, so a PATCH built from a defaulted create schema would silently
 * reset `load_multiplier` to 1 and un-archive a row on every edit. Same trap
 * documented on {@link achievementWriteFields}.
 */
const exerciseWriteFields = {
  display_name: z
    .string()
    .trim()
    .min(1, 'display_name is required')
    .max(60, 'display_name is too long'),
  equipment: exerciseEquipment(),
  muscle_group: exerciseMuscleGroup(),
  load_multiplier: positiveInt(),
  is_unilateral: z.boolean(),
  archived: z.boolean(),
}

/**
 * Request-body schema for `POST /api/admin/weight-room/exercises` (#373).
 *
 * `slug` is lowercased via {@link exerciseWriteField} so the roster can't grow
 * case-divergent duplicates — a set logged against `Bench-Press` must FK to the
 * same row as one logged against `bench-press`. `load_multiplier` defaults to
 * 1 and the two booleans to `false`, matching the DB column defaults, so the
 * common case (a plain barbell movement) needs neither.
 */
export const WeightRoomExerciseUpsertSchema = z
  .object({
    ...exerciseWriteFields,
    slug: exerciseWriteField(),
    load_multiplier: exerciseWriteFields.load_multiplier.default(1),
    is_unilateral: exerciseWriteFields.is_unilateral.default(false),
    archived: exerciseWriteFields.archived.default(false),
  })
  .strict()

/** Validated body of `POST /api/admin/weight-room/exercises`. */
export type WeightRoomExerciseUpsert = z.infer<typeof WeightRoomExerciseUpsertSchema>

/**
 * Request-body schema for `PATCH /api/admin/weight-room/exercises/[slug]`.
 * Every field optional so the editor can flip `archived` alone, but the body
 * must carry at least one field — an empty patch is a client bug, not a no-op.
 *
 * `slug` is absent by design: it's the primary key and the value stored on
 * every logged set. The FK is `on update cascade` so the database *would*
 * propagate a rename, but exposing it through the editor invites renaming a
 * movement mid-history by accident; retiring one is what `archived` is for.
 */
export const WeightRoomExerciseUpdateSchema = z
  .object(exerciseWriteFields)
  .strict()
  .partial()
  .refine(patch => Object.keys(patch).length > 0, {
    message:
      'At least one field (display_name, equipment, muscle_group, load_multiplier, is_unilateral, or archived) is required.',
  })

/** Validated body of `PATCH /api/admin/weight-room/exercises/[slug]`. */
export type WeightRoomExerciseUpdate = z.infer<typeof WeightRoomExerciseUpdateSchema>

/**
 * Zod schema for one row of `public.weight_room_monthly_focus` (#255).
 * Mirrors the table in
 * `supabase/migrations/20260628120100_weight_room_monthly_focus.sql`.
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
  .refine(v => v.end_date >= v.start_date, {
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

/** The six achievement scopes, as a Zod enum reused by the row + write schemas. */
const achievementScope = (): z.ZodType<AchievementScope> =>
  z.enum(['day', 'week', 'month', 'streak', 'lifetime', 'set'])

/** The three achievement measures, as a Zod enum reused by the row + write schemas. */
const achievementMeasure = (): z.ZodType<AchievementMeasure> => z.enum(['reps', 'tonnage', 'load'])

/**
 * Zod schema for one row of `public.weight_room_achievements` (#336) on read.
 * `.strict()` so a column added to the table without updating this schema /
 * the data-layer whitelist fails loudly instead of leaking to the view.
 *
 * `color` / `icon` are `.optional()` (not `.nullable()`) — the data layer maps
 * Postgres `NULL` → absent before validating, matching the sibling schemas.
 * `exercise` is the deliberate exception: it stays explicitly `.nullable()`
 * because `null` *means* something here (the pooled all-movements ladder)
 * rather than "not supplied", and collapsing it to `undefined` would erase
 * that distinction.
 */
export const WeightRoomAchievementRowSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().min(1),
    exercise: z.string().min(1).nullable(),
    scope: achievementScope(),
    // Optional so pre-load-ladder rows (and fixtures) still validate; the DB
    // column is NOT NULL DEFAULT 'reps'. Absent → treated as 'reps'.
    measure: achievementMeasure().optional(),
    threshold: positiveInt(),
    color: z.string().optional(),
    icon: z.string().optional(),
  })
  .strict()

/** Validated `weight_room_achievements` row inferred from {@link WeightRoomAchievementRowSchema}. */
export type WeightRoomAchievementRow = z.infer<typeof WeightRoomAchievementRowSchema>

/**
 * Translate a validated `weight_room_achievements` row into the consumed
 * {@link WeightRoomAchievement} shape. `exercise` passes through as-is
 * (`null` is meaningful); `color` / `icon` are omitted when absent so the
 * optional fields stay `string | undefined`.
 */
export function achievementRowToAchievement(row: WeightRoomAchievementRow): WeightRoomAchievement {
  const achievement: WeightRoomAchievement = {
    id: row.id,
    label: row.label,
    exercise: row.exercise,
    scope: row.scope,
    threshold: row.threshold,
  }
  if (row.measure !== undefined) achievement.measure = row.measure
  if (row.color !== undefined) achievement.color = row.color
  if (row.icon !== undefined) achievement.icon = row.icon
  return achievement
}

/**
 * Request-body schema for `POST /api/admin/weight-room/achievements` (#336).
 *
 * `exercise` accepts a string (lowercased, matching {@link exerciseWriteField}'s
 * anti-duplicate reasoning — a tier for `"Pushups"` must resolve against the
 * same metric as one for `"pushups"`), or an explicit `null` for the pooled
 * ladder. Omitting it defaults to `null`, so a caller that doesn't care about
 * per-exercise scoping gets the pooled tier.
 */
/**
 * The achievement write fields, without any `.default()`.
 *
 * Kept default-free so {@link WeightRoomAchievementUpdateSchema} can be built
 * from it safely. Zod 4 applies `.default()` to a missing key *even inside*
 * `.partial()` (a deliberate change from Zod 3), so deriving the PATCH schema
 * from a create schema that carries defaults would inject `exercise: null` and
 * `measure: 'reps'` into every patch — and the route writes any key that isn't
 * `undefined`. Retuning one threshold would silently convert a per-exercise
 * tier into a pooled one and reset its measure. Defaults belong only on the
 * create path, where a missing key really does mean "use the default".
 */
const achievementWriteFields = {
  label: z.string().trim().min(1, 'label is required').max(60, 'label is too long'),
  exercise: exerciseWriteField().nullable(),
  scope: achievementScope(),
  measure: achievementMeasure(),
  threshold: positiveInt(),
  color: z.string().regex(HEX_COLOR_REGEX, 'color must be a hex string like #EA580C'),
  /**
   * Badge emoji. `null` explicitly clears it back to the scope default — the
   * editor needs a way to say "remove this", which an omitted key can't express
   * under PATCH semantics.
   */
  icon: z.string().trim().min(1).max(8, 'icon should be a single emoji').nullable(),
}

/**
 * Request-body schema for `POST /api/admin/weight-room/achievements`.
 *
 * `label`, `scope`, and `threshold` are required. An omitted `exercise`
 * defaults to `null` (the pooled "all movements" ladder) and an omitted
 * `measure` to `'reps'`, so the common case — a rep tier — needs neither.
 * `color` and `icon` stay optional; the UI supplies its own fallbacks.
 */
export const WeightRoomAchievementCreateSchema = z
  .object({
    ...achievementWriteFields,
    exercise: achievementWriteFields.exercise.default(null),
    measure: achievementWriteFields.measure.default('reps'),
    color: achievementWriteFields.color.optional(),
    icon: achievementWriteFields.icon.optional(),
  })
  .strict()

/** Validated body of `POST /api/admin/weight-room/achievements`. */
export type WeightRoomAchievementCreate = z.infer<typeof WeightRoomAchievementCreateSchema>

/**
 * Request-body schema for `PATCH /api/admin/weight-room/achievements/[id]`.
 * Every field optional so a caller can retune just the threshold, but the body
 * must carry at least one field — an empty patch is a client bug, not a no-op.
 *
 * Built from the default-free {@link achievementWriteFields} so an omitted key
 * stays omitted; see that constant for why that matters.
 */
export const WeightRoomAchievementUpdateSchema = z
  .object(achievementWriteFields)
  .strict()
  .partial()
  .refine(patch => Object.keys(patch).length > 0, {
    message:
      'At least one field (label, exercise, scope, measure, threshold, color, or icon) is required.',
  })

/** Validated body of `PATCH /api/admin/weight-room/achievements/[id]`. */
export type WeightRoomAchievementUpdate = z.infer<typeof WeightRoomAchievementUpdateSchema>
