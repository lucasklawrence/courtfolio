import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  WeightRoomAchievementRowSchema,
  WeightRoomExerciseRowSchema,
  WeightRoomTemplateAlternateRowSchema,
  WeightRoomTemplateSlotRowSchema,
  WeightRoomTemplateSlotStepRowSchema,
  WeightRoomWorkoutTemplateRowSchema,
  assembleWorkoutTemplates as assembleTemplateShape,
  WeightRoomGoalRowSchema,
  WeightRoomGoalTargetRowSchema,
  WeightRoomMonthlyFocusRowSchema,
  WeightRoomSetRowSchema,
  WeightRoomWorkoutRowSchema,
  achievementRowToAchievement,
  exerciseRowToWeightRoomExercise,
  focusRowToMonthlyFocus,
  goalRowToExerciseGoal,
  setRowToStrengthSet,
  workoutRowToWeightRoomWorkout,
} from '@/lib/schemas/weight-room'
import type {
  ExerciseGoal,
  GoalTargetPoint,
  MonthlyFocus,
  WeightRoomAchievement,
  WeightRoomData,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutTemplate,
} from '@/types/weight-room'

import { pacificDayKey } from '@/lib/training-facility/day-keys'
import { currentTarget } from '@/lib/training-facility/goal-targets'

import { fetchAllRows } from './paged-read'

/**
 * Pure Weight Room read helpers shared between the browser entry
 * (`lib/data/weight-room.ts`) and the server entry
 * (`lib/data/weight-room-server.ts`).
 *
 * Mirrors the cardio assembler pattern (`lib/data/cardio-shared.ts`):
 * the entry files own the Supabase client wiring, this module owns the
 * column whitelist + row validation + shape assembly, and the two
 * sides can't drift on what gets read or how it's parsed.
 */

const SETS_TABLE = 'weight_room_sets'
const GOALS_TABLE = 'weight_room_goals'
const FOCUS_TABLE = 'weight_room_monthly_focus'
/** Effective-dated daily-target history backing per-day goal resolution (#362). */
const GOAL_TARGETS_TABLE = 'weight_room_goal_targets'
/** Movement roster — FK target for sets, and the owner of `load_multiplier` (#373). */
const EXERCISES_TABLE = 'weight_room_exercises'

/** Whitelisted column lists for each table; `updated_at` rides along for `imported_at` computation. */
/**
 * Whitelisted columns for `weight_room_sets`, in sync with
 * {@link WeightRoomSetRowSchema}.
 *
 * `workout_id` / `position` (#374) ride along so a set knows which session it
 * belongs to. Every existing aggregation ignores both — an attached set counts
 * exactly as a loose one — but reading them is what lets #376/#377 group sets
 * into a workout without another round trip.
 */
const SETS_COLUMNS =
  'id, logged_at, exercise, reps, weight_lbs, variant, workout_id, position, template_slot_id, template_slot_step_id, updated_at'
// `load_multiplier` deliberately absent (#373) — it moved to the catalog and is
// joined on below. The goals column still exists (dropping it while the
// deployed build still selected it would break the live read) but is dead.
const GOALS_COLUMNS = 'exercise, daily_target, color, kind, updated_at'
const FOCUS_COLUMNS =
  'id, exercise, daily_target, target_kind, color, category, start_date, end_date, updated_at'
const GOAL_TARGETS_COLUMNS = 'id, exercise, daily_target, effective_from, updated_at'
const EXERCISES_COLUMNS =
  'slug, display_name, equipment, muscle_group, load_multiplier, is_unilateral, archived, updated_at'

const WeightRoomSetRowsSchema = z.array(WeightRoomSetRowSchema)
const WeightRoomGoalRowsSchema = z.array(WeightRoomGoalRowSchema)
const WeightRoomMonthlyFocusRowsSchema = z.array(WeightRoomMonthlyFocusRowSchema)
const WeightRoomGoalTargetRowsSchema = z.array(WeightRoomGoalTargetRowSchema)
const WeightRoomExerciseRowsSchema = z.array(WeightRoomExerciseRowSchema)

/**
 * Fetch the movement roster (#373) using the supplied client.
 *
 * Shared between the browser and server entries, and used directly by the
 * Settings catalog editor. Ordered by slug so the editor renders a stable list
 * without re-sorting. Includes archived rows — the editor needs to show them to
 * un-archive them; pickers filter.
 *
 * Returns an empty array (not `null`) when the table is empty, matching
 * {@link assembleWeightRoomAchievements}: an empty roster is a valid state that
 * the editor renders as "add your first movement", not a "no data yet" branch.
 *
 * @param supabase Browser or server SSR client (both anon role; the table's RLS
 *   allows anon SELECT).
 * @throws when the Supabase query fails or row-shape validation fails.
 */
export async function assembleWeightRoomExercises(
  supabase: SupabaseClient
): Promise<WeightRoomExercise[]> {
  const res = await supabase
    .from(EXERCISES_TABLE)
    .select(EXERCISES_COLUMNS)
    .order('slug', { ascending: true })

  if (res.error) {
    throw new Error(`Failed to load weight room exercises: ${res.error.message}`)
  }

  return parseExerciseRows((res.data ?? []) as unknown as Array<Record<string, unknown>>)
}

/** Workout-template tables (#375). */
const TEMPLATES_TABLE = 'weight_room_workout_templates'
const TEMPLATE_SLOTS_TABLE = 'weight_room_template_slots'
const TEMPLATE_STEPS_TABLE = 'weight_room_template_slot_steps'
const TEMPLATE_ALTERNATES_TABLE = 'weight_room_template_alternates'

/** Whitelisted columns for `weight_room_workout_templates`, in sync with its row schema. */
const TEMPLATES_COLUMNS = 'id, name, description, color, category, position, archived'
/** Whitelisted columns for `weight_room_template_slots`. */
const TEMPLATE_SLOTS_COLUMNS =
  'id, template_id, position, exercise, target_sets, target_sets_max, target_reps, target_reps_max, target_weight_lbs, rest_seconds, notes'
/** Whitelisted columns for `weight_room_template_slot_steps`. */
const TEMPLATE_STEPS_COLUMNS =
  'id, slot_id, position, exercise, target_reps, target_weight_lbs, notes'
/** Whitelisted columns for `weight_room_template_alternates`. */
const TEMPLATE_ALTERNATES_COLUMNS = 'id, slot_id, position, exercise'

const WeightRoomWorkoutTemplateRowsSchema = z.array(WeightRoomWorkoutTemplateRowSchema)
const WeightRoomTemplateSlotRowsSchema = z.array(WeightRoomTemplateSlotRowSchema)
const WeightRoomTemplateSlotStepRowsSchema = z.array(WeightRoomTemplateSlotStepRowSchema)
const WeightRoomTemplateAlternateRowsSchema = z.array(WeightRoomTemplateAlternateRowSchema)

/**
 * Fetch every workout template (#375) with its slots, steps, and alternates
 * attached, ordered by `position` at every level.
 *
 * Reads the four tables in parallel and assembles in memory rather than using a
 * PostgREST embedded select. An embed returns a nested object that no single
 * `.strict()` row schema can validate — which is exactly how a column added to
 * one of these tables would slip past validation unnoticed, the failure mode
 * the whitelist-plus-strict-schema convention exists to prevent.
 *
 * Returns an empty array (never `null`) when nothing is configured, matching
 * {@link assembleWeightRoomExercises}. Includes archived templates so the
 * builder can un-archive them; pickers filter.
 *
 * @param supabase Browser or server SSR client (both anon role; RLS allows
 *   anon SELECT on all four tables).
 * @throws when any query fails or any row-shape validation fails.
 */
export async function assembleWorkoutTemplates(
  supabase: SupabaseClient
): Promise<WorkoutTemplate[]> {
  const [templatesRes, slotsRes, stepsRes, alternatesRes] = await Promise.all([
    supabase.from(TEMPLATES_TABLE).select(TEMPLATES_COLUMNS).order('position', { ascending: true }),
    supabase
      .from(TEMPLATE_SLOTS_TABLE)
      .select(TEMPLATE_SLOTS_COLUMNS)
      .order('position', { ascending: true }),
    supabase
      .from(TEMPLATE_STEPS_TABLE)
      .select(TEMPLATE_STEPS_COLUMNS)
      .order('position', { ascending: true }),
    supabase
      .from(TEMPLATE_ALTERNATES_TABLE)
      .select(TEMPLATE_ALTERNATES_COLUMNS)
      .order('position', { ascending: true }),
  ])

  if (templatesRes.error) {
    throw new Error(`Failed to load workout templates: ${templatesRes.error.message}`)
  }
  if (slotsRes.error) {
    throw new Error(`Failed to load template slots: ${slotsRes.error.message}`)
  }
  if (stepsRes.error) {
    throw new Error(`Failed to load template slot steps: ${stepsRes.error.message}`)
  }
  if (alternatesRes.error) {
    throw new Error(`Failed to load template alternates: ${alternatesRes.error.message}`)
  }

  const templates = parseRows(
    WeightRoomWorkoutTemplateRowsSchema,
    templatesRes.data,
    TEMPLATES_TABLE
  )
  const slots = parseRows(WeightRoomTemplateSlotRowsSchema, slotsRes.data, TEMPLATE_SLOTS_TABLE)
  const steps = parseRows(WeightRoomTemplateSlotStepRowsSchema, stepsRes.data, TEMPLATE_STEPS_TABLE)
  const alternates = parseRows(
    WeightRoomTemplateAlternateRowsSchema,
    alternatesRes.data,
    TEMPLATE_ALTERNATES_TABLE
  )

  return assembleTemplateShape(templates, slots, steps, alternates)
}

/** Bounded training sessions (#374) — the unit every #377 statistic is computed over. */
const WORKOUTS_TABLE = 'weight_room_workouts'

/** Whitelisted columns for `weight_room_workouts`, in sync with {@link WeightRoomWorkoutRowSchema}. */
const WORKOUTS_COLUMNS =
  'id, started_at, ended_at, template_id, prescription, source, avg_hr, max_hr, title, location, notes, updated_at'

const WeightRoomWorkoutRowsSchema = z.array(WeightRoomWorkoutRowSchema)

/**
 * Fetch every recorded workout (#374), newest first.
 *
 * Paged like the set read: sessions accumulate indefinitely and PostgREST caps
 * a single response, so a hard limit here would silently truncate the oldest
 * history once the log outgrew one page.
 *
 * Returns an empty array (never `null`) when nothing has been recorded, matching
 * {@link assembleWorkoutTemplates} — no workouts yet is a state the history page
 * renders, not a "no data" branch.
 *
 * @param supabase Browser or server SSR client (both anon role; RLS allows anon
 *   SELECT).
 * @throws when the query fails or row-shape validation fails.
 */
export async function assembleWeightRoomWorkouts(
  supabase: SupabaseClient
): Promise<WeightRoomWorkout[]> {
  const rows = await fetchAllRows(
    () =>
      supabase
        .from(WORKOUTS_TABLE)
        .select(WORKOUTS_COLUMNS)
        .order('started_at', { ascending: false })
        // `started_at` alone isn't a total order — two sessions can share an
        // instant — and an ambiguous sort repeats or skips rows across page
        // boundaries. Same tie-breaker reasoning as the set read (#229).
        .order('id', { ascending: false }),
    WORKOUTS_TABLE
  )
  const parsed = parseRows(WeightRoomWorkoutRowsSchema, rows.map(stripUpdatedAt), WORKOUTS_TABLE)
  return parsed.map(workoutRowToWeightRoomWorkout)
}

/**
 * Validate one table's rows, or throw naming the table.
 *
 * @param schema Array schema for the table.
 * @param data Raw PostgREST rows.
 * @param table Table name, for the error message.
 */
function parseRows<T>(schema: z.ZodType<T[]>, data: unknown, table: string): T[] {
  const raw = (data ?? []) as Array<Record<string, unknown>>
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`${table} failed schema validation: ${parsed.error.message}`)
  }
  return parsed.data
}

/**
 * Validate raw catalog rows and convert them to {@link WeightRoomExercise}.
 * Factored out so {@link assembleWeightRoomData} and
 * {@link assembleWeightRoomExercises} can't drift on how the roster is parsed.
 *
 * @param raw Rows straight from PostgREST, still carrying `updated_at`.
 * @throws when row-shape validation fails.
 */
function parseExerciseRows(raw: Array<Record<string, unknown>>): WeightRoomExercise[] {
  const parsed = WeightRoomExerciseRowsSchema.safeParse(raw.map(stripUpdatedAt))
  if (!parsed.success) {
    throw new Error(`weight_room_exercises failed schema validation: ${parsed.error.message}`)
  }
  return parsed.data.map(exerciseRowToWeightRoomExercise)
}

/**
 * Attach each goal's `load_multiplier` and `display_name` from the catalog
 * (#373, #384).
 *
 * `load_multiplier` moved to `weight_room_exercises` so movements without a
 * daily goal could carry it, but the tonnage math in `achievements.ts`,
 * `monthly-focus.ts`, and `LogDataIsland` all read it off {@link ExerciseGoal}
 * — joining it here keeps every one of those call sites unchanged.
 * `display_name` rides the same join for the same reason: the ~10 surfaces that
 * render a goal's name would otherwise each need the roster threaded to them.
 *
 * A multiplier of 1 is omitted rather than attached: it's the documented
 * default at every read site, so leaving it off keeps the pre-#373 shape for
 * the movements where nothing changed. A `display_name` equal to the slug is
 * omitted on the same principle.
 *
 * @param goals Converted goals, in read order.
 * @param exercises The full roster, used to build the lookup.
 */
function attachCatalogFields(
  goals: readonly ExerciseGoal[],
  exercises: readonly WeightRoomExercise[]
): ExerciseGoal[] {
  const bySlug = new Map(exercises.map(exercise => [exercise.slug, exercise]))
  return goals.map(goal => {
    // A goal with no catalog row is impossible — the FK guarantees one — but
    // defaulting rather than asserting keeps a partially-migrated project
    // rendering instead of throwing.
    const entry = bySlug.get(goal.exercise)
    const multiplier = entry?.load_multiplier ?? 1
    const label = entry?.display_name

    const next: ExerciseGoal = { ...goal }
    if (multiplier !== 1) next.load_multiplier = multiplier
    if (label !== undefined && label !== goal.exercise) next.display_name = label
    return next
  })
}

/**
 * Attach each focus's `display_name` from the catalog (#384), mirroring
 * {@link attachCatalogFields}. The rotation cards, the upcoming strip, and the
 * lane heatmap legend all render {@link MonthlyFocus.exercise} directly.
 *
 * @param focuses Converted focuses, in read order.
 * @param exercises The full roster, used to build the lookup.
 */
function attachFocusDisplayNames(
  focuses: readonly MonthlyFocus[],
  exercises: readonly WeightRoomExercise[]
): MonthlyFocus[] {
  const labelBySlug = new Map(exercises.map(e => [e.slug, e.display_name]))
  return focuses.map(focus => {
    const label = labelBySlug.get(focus.exercise)
    return label === undefined || label === focus.exercise
      ? focus
      : { ...focus, display_name: label }
  })
}

/** Supabase table backing the Trophy Room achievement ladder (#336). */
const ACHIEVEMENTS_TABLE = 'weight_room_achievements'

/** Whitelisted columns for `weight_room_achievements`, in sync with {@link WeightRoomAchievementRowSchema}. */
const ACHIEVEMENTS_COLUMNS = 'id, label, exercise, scope, measure, threshold, color, icon'

/** Array form of {@link WeightRoomAchievementRowSchema} for validating the ladder read. */
const WeightRoomAchievementRowsSchema = z.array(WeightRoomAchievementRowSchema)

/**
 * Fetch the Trophy Room achievement ladder (#336) using the supplied client.
 * Shared between `getWeightRoomAchievements` (browser) and
 * `getWeightRoomAchievementsServer` (server) so the read shape and validation
 * can't drift.
 *
 * Unlike {@link assembleWeightRoomData}, returns an **empty array** (not
 * `null`) when the table is empty — the Trophy Room always renders its metric
 * summary, just with no badges to unlock, so an empty ladder is a valid steady
 * state rather than a "no data yet" branch. Ordered by exercise then scope
 * then threshold so callers get the wall grouped and low → high without
 * re-sorting.
 *
 * @param supabase Browser or server SSR client (both anon role; the table's RLS
 *   allows anon SELECT).
 * @throws when the Supabase query fails or row-shape validation fails. The
 *   Trophy Room downgrades this to an empty ladder so a read blip can't blank
 *   the page.
 */
export async function assembleWeightRoomAchievements(
  supabase: SupabaseClient
): Promise<WeightRoomAchievement[]> {
  // `nullsFirst` puts the pooled "all movements" tiers at the head of the
  // ladder, which is also where the Trophy Room renders them.
  const res = await supabase
    .from(ACHIEVEMENTS_TABLE)
    .select(ACHIEVEMENTS_COLUMNS)
    .order('exercise', { ascending: true, nullsFirst: true })
    .order('scope', { ascending: true })
    .order('threshold', { ascending: true })

  if (res.error) {
    throw new Error(`Failed to load weight room achievements: ${res.error.message}`)
  }

  const raw = (res.data ?? []) as unknown as Array<Record<string, unknown>>
  const parsed = WeightRoomAchievementRowsSchema.safeParse(raw.map(stripNullBadgeFields))
  if (!parsed.success) {
    throw new Error(`weight_room_achievements failed schema validation: ${parsed.error.message}`)
  }

  return parsed.data.map(achievementRowToAchievement)
}

/**
 * Drop `color` / `icon` when Postgres returned `NULL`, so they validate as
 * `.optional()` rather than needing `.nullable()` — the convention every
 * sibling row schema follows.
 *
 * `exercise` is deliberately left alone: a `null` there is the pooled
 * "all movements" ladder, a real value rather than an absent one.
 */
function stripNullBadgeFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === null && key !== 'exercise') continue
    out[key] = value
  }
  return out
}

/**
 * Fetch the full Weight Room dataset from Supabase using the supplied
 * client. Shared between `getWeightRoomData` (browser) and
 * `getWeightRoomDataServer` (server) so the two read paths can't drift
 * in column whitelist, validation, or shape assembly.
 *
 * Queries both tables in parallel, normalizes Postgres `null` to absent
 * (the row schemas declare optional fields with `.optional()`, not
 * `.nullable()`), validates each table against its row-shape schema,
 * and assembles the result into the public {@link WeightRoomData} shape.
 *
 * Returns `null` when both tables are empty — preserves the
 * "no data yet" contract so detail views can substitute placeholder
 * fixtures rather than treating it as an error. Note that the migration
 * seeds two default goals (`pushups`, `pullups`), so in practice the
 * goals table is never empty after the migration is applied; this null
 * branch covers the pre-migration state and the case where every
 * default goal has been deleted via the settings UI.
 *
 * `imported_at` is computed as `MAX(updated_at)` across both tables.
 *
 * @param supabase Either the browser or the server SSR client. Both
 *   use the anon role; Weight Room RLS allows anon SELECT.
 * @throws when either Supabase query fails (network / misconfigured env
 *   / RLS regression) or when row-shape validation fails. Callers
 *   usually downgrade this to an empty render.
 */
export async function assembleWeightRoomData(
  supabase: SupabaseClient
): Promise<WeightRoomData | null> {
  // Secondary sort keys make ties deterministic (#229): backdated sets
  // all stamp local noon of their day, so `logged_at` alone left their
  // relative order unstable between fetches. `updated_at` resolves ties
  // by insertion order (sets have no update path), and `id` backstops
  // same-transaction inserts whose `updated_at` also collides.
  const [setsRaw, goalsRes, focusRes, goalTargetsRes, exercisesRes] = await Promise.all([
    // Paged — the set log is the one table here that grows without bound, and
    // it crossed PostgREST's response cap in July 2026, silently dropping the
    // *newest* sets (this query sorts ascending). The multi-key order above is
    // also what makes paging stable. See {@link fetchAllRows}.
    fetchAllRows(
      () =>
        supabase
          .from(SETS_TABLE)
          .select(SETS_COLUMNS)
          .order('logged_at', { ascending: true })
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true }),
      'weight room sets'
    ),
    supabase.from(GOALS_TABLE).select(GOALS_COLUMNS).order('exercise', { ascending: true }),
    // Newest window first so the "Upcoming"/roadmap UI can slice from
    // the head without re-sorting.
    supabase.from(FOCUS_TABLE).select(FOCUS_COLUMNS).order('start_date', { ascending: false }),
    // Oldest window first: `targetForDay` wants ascending order, and sorting
    // here means the resolver's defensive re-sort is a no-op on live data.
    supabase
      .from(GOAL_TARGETS_TABLE)
      .select(GOAL_TARGETS_COLUMNS)
      .order('exercise', { ascending: true })
      .order('effective_from', { ascending: true }),
    // The roster (#373). Read here rather than in a second round trip because
    // the goals below need its `load_multiplier` joined on regardless.
    supabase.from(EXERCISES_TABLE).select(EXERCISES_COLUMNS).order('slug', { ascending: true }),
  ])

  if (goalsRes.error) {
    throw new Error(`Failed to load weight room goals: ${goalsRes.error.message}`)
  }
  if (focusRes.error) {
    throw new Error(`Failed to load weight room monthly focus: ${focusRes.error.message}`)
  }
  if (goalTargetsRes.error) {
    throw new Error(`Failed to load weight room goal targets: ${goalTargetsRes.error.message}`)
  }
  if (exercisesRes.error) {
    throw new Error(`Failed to load weight room exercises: ${exercisesRes.error.message}`)
  }

  const goalsRaw = (goalsRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const focusRaw = (focusRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const goalTargetsRaw = (goalTargetsRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const exercisesRaw = (exercisesRes.data ?? []) as unknown as Array<Record<string, unknown>>

  // Compute imported_at before stripping `updated_at` — that column lives
  // on every row but isn't part of the row-shape schema (`.strict()`
  // would reject it).
  const importedAt = computeImportedAt([setsRaw, goalsRaw, focusRaw, goalTargetsRaw, exercisesRaw])

  // A monthly focus can't exist without its `kind: 'focus'` goal anchor
  // (FK), so sets+goals empty still means "no data" — focus is implied
  // empty. Keeping the original two-table condition preserves the
  // pre-baseline null contract.
  if (setsRaw.length === 0 && goalsRaw.length === 0) {
    return null
  }

  const setsParsed = WeightRoomSetRowsSchema.safeParse(setsRaw.map(stripUpdatedAt))
  if (!setsParsed.success) {
    throw new Error(`weight_room_sets failed schema validation: ${setsParsed.error.message}`)
  }
  const goalsParsed = WeightRoomGoalRowsSchema.safeParse(goalsRaw.map(stripUpdatedAt))
  if (!goalsParsed.success) {
    throw new Error(`weight_room_goals failed schema validation: ${goalsParsed.error.message}`)
  }
  const focusParsed = WeightRoomMonthlyFocusRowsSchema.safeParse(focusRaw.map(stripUpdatedAt))
  if (!focusParsed.success) {
    throw new Error(
      `weight_room_monthly_focus failed schema validation: ${focusParsed.error.message}`
    )
  }
  const goalTargetsParsed = WeightRoomGoalTargetRowsSchema.safeParse(
    goalTargetsRaw.map(stripUpdatedAt)
  )
  if (!goalTargetsParsed.success) {
    throw new Error(
      `weight_room_goal_targets failed schema validation: ${goalTargetsParsed.error.message}`
    )
  }

  const historyByExercise = groupTargetHistory(goalTargetsParsed.data)
  const exercises = parseExerciseRows(exercisesRaw)

  // Resolved once for the whole read so every goal agrees on "today" even if
  // the assembly straddles Pacific midnight.
  const todayKey = pacificDayKey(new Date())

  const goals = goalsParsed.data.map(row => {
    const goal = goalRowToExerciseGoal(row)
    const history = historyByExercise.get(goal.exercise)
    // Omit rather than attach `[]` so "no recorded history" is a single
    // shape everywhere — `targetForDay` treats absent and empty the same,
    // but keeping one of them off the wire makes fixtures and snapshots
    // easier to read.
    const withHistory = history === undefined ? goal : { ...goal, target_history: history }

    // Resolve the current target on *read* rather than trusting the column
    // (#371). `weight_room_goals.daily_target` is a mirror written at edit
    // time, so a change scheduled for a future date would never activate —
    // nothing runs on that date to re-sync it. Resolving here means the
    // change simply becomes current when its day arrives, with no cron, no
    // re-save, and no deploy, and every consumer that reads the mirror is
    // correct for free.
    //
    // `currentTarget` ignores entries dated after `todayKey`, so a scheduled
    // row is invisible until it activates, and keeps the column whenever no
    // entry is in effect yet — including the goal whose whole history is
    // future-dated, where `targetForDay` alone would activate it early.
    const resolved = currentTarget(withHistory, todayKey)
    return resolved === withHistory.daily_target
      ? withHistory
      : { ...withHistory, daily_target: resolved }
  })

  return {
    imported_at: importedAt,
    sets: setsParsed.data.map(setRowToStrengthSet),
    goals: attachCatalogFields(goals, exercises),
    monthly_focus: attachFocusDisplayNames(focusParsed.data.map(focusRowToMonthlyFocus), exercises),
    exercises,
  }
}

/**
 * Group validated `weight_room_goal_targets` rows into per-exercise history
 * arrays, oldest entry first.
 *
 * Exercises with no rows are simply absent from the map, so the caller omits
 * `target_history` entirely for them and every consumer falls back to the
 * goal's current `daily_target` — the pre-#362 behavior.
 *
 * @param rows Validated target rows, in any order.
 */
function groupTargetHistory(
  rows: readonly { exercise: string; daily_target: number; effective_from: string }[]
): Map<string, GoalTargetPoint[]> {
  const byExercise = new Map<string, GoalTargetPoint[]>()
  for (const row of rows) {
    const entry = byExercise.get(row.exercise)
    const point: GoalTargetPoint = {
      daily_target: row.daily_target,
      effective_from: row.effective_from,
    }
    if (entry === undefined) {
      byExercise.set(row.exercise, [point])
    } else {
      entry.push(point)
    }
  }
  // The query orders by effective_from, but sort defensively so a fixture or
  // a future query change can't hand the resolver unordered history.
  for (const history of byExercise.values()) {
    history.sort((a, b) =>
      a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0
    )
  }
  return byExercise
}

/**
 * Drop the `updated_at` audit column before Zod-parsing. The row
 * schemas use `.strict()`, which would otherwise reject the column —
 * but we still need it on the raw row to compute `imported_at`, so the
 * caller pulls it off the un-stripped rows first.
 */
function stripUpdatedAt(row: Record<string, unknown>): Record<string, unknown> {
  if (!('updated_at' in row)) return row
  const { updated_at: _ignored, ...rest } = row
  return rest
}

/**
 * Determine `imported_at` from the latest `updated_at` across both
 * tables. Returns `''` when no rows have an `updated_at` value — same
 * fallback components already use for the "no data yet" state on the
 * cardio side.
 *
 * Lexicographic string compare is safe here because PostgREST returns
 * every `timestamptz` in the same canonical UTC form
 * (`YYYY-MM-DDTHH:MM:SS.uuuuuu+00:00`), which sorts by actual time
 * without parsing.
 */
function computeImportedAt(rowGroups: Array<Array<Record<string, unknown>>>): string {
  let latest = ''
  for (const rows of rowGroups) {
    for (const row of rows) {
      const value = row.updated_at
      if (typeof value === 'string' && value > latest) {
        latest = value
      }
    }
  }
  return latest
}
