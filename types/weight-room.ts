/**
 * Weight Room data schema (PRD §7.6 / #79) — bodyweight strength tracking,
 * "grease the groove" pattern. Single source of truth shared with the
 * Supabase row schemas in `lib/schemas/weight-room.ts` and the admin
 * write API routes (`app/api/admin/weight-room/*`).
 *
 * Field names are snake_case to match the Supabase column names, mirroring
 * the cardio data model's convention.
 */

/**
 * One logged set — an exercise + rep count + when it happened. The
 * Today View's quick-log inserts these as the user taps through their
 * "grease the groove" sets across the day.
 */
export interface StrengthSet {
  /** UUID primary key, generated server-side. */
  id: string
  /** ISO 8601 timestamp the set was logged at (matches `logged_at` column). */
  logged_at: string
  /**
   * Exercise slug (`pushups`, `barbell-bench-press`, …). Foreign-keyed to
   * {@link WeightRoomExercise.slug} — the movement roster, *not* the daily-goal
   * overlay (#373), so a gym lift with no daily target is still loggable.
   *
   * The FK is `on delete restrict`: a movement with logged sets can't be
   * deleted, only {@link WeightRoomExercise.archived}. Before #373 it cascaded
   * from `weight_room_goals`, so removing a daily goal destroyed that
   * movement's entire history.
   */
  exercise: string
  /** Rep count for this single set. Always positive (DB CHECK enforces). */
  reps: number
  /**
   * Optional external load in pounds for this set — e.g. weighted
   * shrugs in a monthly focus (#255). Absent for bodyweight movements
   * (pushups, pullups). Feeds the load stats (top set, avg load,
   * tonnage = Σ reps×weight); never part of the daily-ring rollup,
   * which is rep-based.
   */
  weight_lbs?: number
  /**
   * Optional exercise variant for this set (#254) — the grip / width /
   * tempo used, e.g. `wide` / `close` / `neutral` for pullups. Absent
   * means "unspecified" (the set still counts, just without a tagged
   * grip). Lowercased on write so the History View can bucket by exact
   * string. Does NOT affect the daily-ring rollup: every variant of an
   * exercise sums into that exercise's single ring — it exists only to
   * *slice* volume by variant in the History View, never to split it.
   */
  variant?: string
  /**
   * The bounded {@link WeightRoomWorkout} this set belongs to (#374), or absent
   * for a set logged **loose** — a grease-the-groove set at a desk, and every
   * set predating workouts.
   *
   * Absent is a real answer, not missing data: historical GTG sets were never
   * workouts, and nothing backfills them. The API never infers this either — a
   * set joins a session only when the caller passes it explicitly, so an
   * afternoon pushup set can't silently become part of the morning's gym visit.
   */
  workout_id?: string
  /**
   * Order of this set *within its workout* — not within its exercise — so an
   * interleaved superset, or a set squeezed in while waiting on a rack, renders
   * in the order it actually happened. Absent for loose sets and wherever the
   * writer didn't care. Gaps are fine; nothing renumbers.
   */
  position?: number
}

/**
 * Where a {@link WeightRoomWorkout} happened (#374). Coarse on purpose — it
 * exists to separate "at the gym" from "in the living room" when reading back
 * a session, not to model venues.
 */
export type WorkoutLocation = 'gym' | 'home' | 'travel' | 'other'

/**
 * One bounded training session (#374) — mirrors a row of
 * `public.weight_room_workouts`.
 *
 * A workout is an *event* (walk in, do five movements, walk out), which is a
 * different unit from the calendar day every other Weight Room aggregation is
 * built on. That difference is the point: duration, density, and per-session
 * comparison are inexpressible when the day is the only bucket.
 *
 * Grease-the-groove sets deliberately have no workout. A null
 * {@link StrengthSet.workout_id} means "logged loose", permanently.
 */
export interface WeightRoomWorkout {
  /** UUID primary key, generated server-side. */
  id: string
  /**
   * ISO 8601 timestamp the session began.
   *
   * Also decides which calendar day the workout belongs to: a session crossing
   * midnight belongs **wholly to its start day**, resolved in Pacific via
   * {@link import('@/lib/training-facility/day-keys').pacificDayKey}. Splitting
   * one across two days would be wrong in every stat.
   */
  started_at: string
  /**
   * ISO 8601 timestamp the session finished, or absent while **in progress**.
   *
   * At most one workout may be in progress at a time (a partial unique index
   * enforces it). One left open past
   * {@link import('@/lib/training-facility/workout-sessions').STALE_WORKOUT_HOURS}
   * is auto-ended when the next session starts — stamped at its last set's
   * `logged_at`, which is the last real evidence of activity rather than a
   * guess.
   */
  ended_at?: string
  /** Free-text label, e.g. `Push Day`. Absent when unnamed. */
  title?: string
  /** Where it happened. Absent when unspecified. */
  location?: WorkoutLocation
  /** Free-text notes captured when ending the session. Absent when none. */
  notes?: string
}

/**
 * How a movement is loaded (#373). Drives the catalog's equipment filter and,
 * once templates land, "what can I swap this for when the rack is taken".
 *
 * `'bodyweight'` is the explicit marker for movements that carry no external
 * load — previously this was *inferred* from `weight_lbs IS NULL` plus a
 * share-of-weighted-sets threshold in `load-management.ts`.
 */
export type ExerciseEquipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'band'
  | 'bodyweight'
  | 'other'

/**
 * Coarse body region a movement trains (#373). Deliberately seven buckets
 * rather than a per-muscle taxonomy: enough to organize a catalog of ~30 lifts
 * and a template builder, and it lines up with the existing upper/lower
 * {@link FocusCategory} lanes. Splitting finer later is a check-constraint
 * change, not a redesign.
 */
export type ExerciseMuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'full-body'

/**
 * One movement in the Weight Room roster (#373) — mirrors a row of
 * `public.weight_room_exercises`.
 *
 * This is the FK target for every logged set, so a movement must exist here
 * before it can be logged. It is deliberately *separate* from
 * {@link ExerciseGoal}: the catalog says "this movement exists and here's how
 * it's loaded", while a goal says "and I want N reps of it every day". Gym
 * lifts have the former and not the latter — which is the whole point, since
 * `weight_room_goals.daily_target` is `not null check (> 0)` and there is no
 * honest daily rep target for a bench press.
 */
export interface WeightRoomExercise {
  /**
   * Primary key and the value stored in {@link StrengthSet.exercise}. Lowercase
   * kebab-case (`barbell-bench-press`); lowercased on write by the API so
   * `Pushups` and `pushups` can't diverge into two roster entries.
   */
  slug: string
  /**
   * Human-readable label (`Barbell Bench Press`). Exists because {@link slug}
   * doubles as the primary key and reads badly in UI. Stored and editable as of
   * #373; the Today / History / Trophy Room surfaces still render the slug
   * until the label rollout follow-up.
   */
  display_name: string
  /** How the movement is loaded. */
  equipment: ExerciseEquipment
  /** Coarse body region this movement trains. */
  muscle_group: ExerciseMuscleGroup
  /**
   * How many loaded implements this movement moves per set. Absent is treated
   * as `1`.
   *
   * {@link StrengthSet.weight_lbs} records the load on *one* implement, since
   * that's how it's read off the equipment — a "60 lb dumbbell shrug" is 60 per
   * hand, not 60 total. Movements carried two at a time (shrugs, dumbbell
   * press) set this to `2`, so effective load is `weight_lbs × load_multiplier`.
   * Barbell, machine, vest, dip belt, and bodyweight work all stay at `1`.
   *
   * Moved here from `weight_room_goals` in #373 — it describes how a movement
   * is performed, so it has to be available for movements that have no daily
   * goal at all.
   */
  load_multiplier?: number
  /**
   * Whether the movement trains one side at a time (single-arm dumbbell row).
   *
   * Orthogonal to {@link load_multiplier}, which counts implements moved
   * *simultaneously*: a single-arm row is unilateral with multiplier 1, a
   * two-dumbbell press is bilateral with multiplier 2. Absent is treated as
   * `false`.
   */
  is_unilateral?: boolean
  /**
   * Soft-retire flag. Archived movements stay in the roster (their sets are
   * FK'd to it and the FK is `on delete restrict`, so they can never be
   * deleted) but drop out of pickers. Absent is treated as `false`.
   */
  archived?: boolean
}

/**
 * One entry in an exercise's daily-target history (#362) — the target that
 * took effect on {@link effective_from} and stayed in effect until the next
 * entry (or forever, if it's the newest). Mirrors a row of
 * `public.weight_room_goal_targets`.
 *
 * Resolve "what was the target on day D" with
 * {@link import('@/lib/training-facility/goal-targets').targetForDay} rather
 * than scanning this array by hand — it owns the before-first-entry fallback
 * and the non-positive-target clamp.
 */
export interface GoalTargetPoint {
  /**
   * Target reps per day that took effect on {@link effective_from}. Positive
   * (DB CHECK enforces), same units as {@link ExerciseGoal.daily_target}.
   */
  daily_target: number
  /**
   * Inclusive first day this target applies to, as a bare `YYYY-MM-DD` local
   * date. PostgREST renders a Postgres `date` in this canonical form, so
   * lexicographic string comparison against a day key is exactly
   * chronological comparison — no `Date` parsing needed.
   */
  effective_from: string
}

/**
 * Per-exercise daily target + display color. Drives the Today View's
 * activity rings and the History View's heatmap intensity. Managed via
 * the Settings UI; the migration seeds `pushups` (rim-orange) and
 * `pullups` (teal) so a fresh project has something to render.
 */
export interface ExerciseGoal {
  /** Exercise name; primary key on `weight_room_goals`. */
  exercise: string
  /**
   * Target reps per day for the "grease the groove" goal. Activity
   * rings fill toward this number; the heatmap colors by % of target.
   *
   * This is the *current* target — a denormalized mirror of the newest
   * {@link target_history} entry, kept for cheap reads. Historical rollups
   * must NOT divide by it; they resolve the target in effect on each day via
   * {@link import('@/lib/training-facility/goal-targets').targetForDay}, or a
   * goal change would retroactively re-score days already completed (#362).
   */
  daily_target: number
  /**
   * Hex color (e.g. `#EA580C`) used by the rings and heatmap so each
   * exercise reads as its own visual lane. Stored as a string rather
   * than an enum so adding a new exercise via the settings UI doesn't
   * require a code change.
   */
  color: string
  /**
   * Whether this is a permanent daily ring or the anchor row for a
   * time-boxed monthly focus (#255). Absent is treated as
   * `'permanent'` (every pre-#255 goal). A `'focus'` goal is rendered
   * on the Today View only while its {@link MonthlyFocus} window covers
   * the viewed day, so a finished focus doesn't leave a stale empty
   * ring. Mirrors `weight_room_goals.kind`.
   */
  kind?: 'permanent' | 'focus'
  /**
   * How many loaded implements this movement moves per set. Absent is treated
   * as `1`.
   *
   * **Joined from {@link WeightRoomExercise.load_multiplier}**, which owns it as
   * of #373 — the column moved to the catalog so movements without a daily goal
   * could carry it too. The data layer attaches it here on read so the tonnage
   * math in `achievements.ts` / `monthly-focus.ts` / `LogDataIsland` keeps
   * reading it off the goal unchanged. Editing it means editing the catalog.
   */
  load_multiplier?: number
  /**
   * Effective-dated history of this goal's {@link daily_target} (#362), oldest
   * entry first. Attached by the data layer from
   * `public.weight_room_goal_targets`.
   *
   * Absent or empty means "no recorded history" — every consumer then falls
   * back to {@link daily_target} for all days, which is exactly the pre-#362
   * behavior. The migration backfills one entry per goal dated at or before
   * the earliest logged set, so in practice this is populated.
   */
  target_history?: GoalTargetPoint[]
}

/**
 * Body-region lane for a {@link MonthlyFocus} (#286). Two focuses can run
 * concurrently — at most one per category — so the Today View shows an
 * upper-body and a lower-body "grease the groove" campaign side by side.
 */
export type FocusCategory = 'upper' | 'lower'

/**
 * One "grease the groove" monthly focus (#255) — a time-boxed campaign
 * to do an accessory movement every day for a month, then rotate.
 * Mirrors a row of `public.weight_room_monthly_focus`. The roadmap is
 * the full list (past, active, upcoming); "upcoming" = a focus whose
 * {@link MonthlyFocus.start_date} is after today.
 *
 * A focus shares its `exercise` with a `kind: 'focus'`
 * {@link ExerciseGoal} so its sets log and roll up through the exact
 * same machinery as permanent exercises.
 */
export interface MonthlyFocus {
  /** UUID primary key, generated server-side. */
  id: string
  /**
   * Exercise name (e.g. `shrugs`). Foreign-keyed to the matching
   * `kind: 'focus'` {@link ExerciseGoal.exercise} that anchors logging.
   */
  exercise: string
  /**
   * Target for the daily ring during the focus window. Interpreted per
   * {@link MonthlyFocus.target_kind}: reps/day or distinct sets/day.
   */
  daily_target: number
  /**
   * Whether {@link MonthlyFocus.daily_target} counts reps (`'reps'`,
   * the default — ring fills on rep total) or distinct logged sets
   * (`'sets'`). `'sets'` is modeled but unused until a future focus
   * needs it.
   */
  target_kind: 'reps' | 'sets'
  /** Hex color for the focus's ring/strip (e.g. `#C9A268`). */
  color: string
  /**
   * Body-region lane (#286). The read layer surfaces one active focus per
   * category, so an `'upper'` and a `'lower'` focus render as two rings at
   * once. When more than one focus in the same lane overlaps a day, the
   * most recently started ({@link MonthlyFocus.start_date}) wins.
   */
  category: FocusCategory
  /** Inclusive first day of the focus window, `YYYY-MM-DD` local date. */
  start_date: string
  /** Inclusive last day of the focus window, `YYYY-MM-DD` local date. */
  end_date: string
}

/**
 * Which metric an {@link WeightRoomAchievement} threshold measures (#336).
 *
 * - `'day'` / `'week'` / `'month'` — reps summed over that calendar bucket.
 *   Weeks are ISO (Mon–Sun), matching the History view's heatmap rows and
 *   weekly-volume chart so a badge and a bar can't disagree.
 * - `'streak'` — consecutive calendar days hitting the daily target; the
 *   threshold counts *days*, not reps.
 * - `'lifetime'` — cumulative reps across the entire log.
 * - `'set'` — reps in a single unbroken set.
 */
export type AchievementScope = 'day' | 'week' | 'month' | 'streak' | 'lifetime' | 'set'

/**
 * What an {@link WeightRoomAchievement} threshold counts, orthogonal to its
 * {@link AchievementScope} (which says over what window).
 *
 * - `'reps'` — rep count. The default, and what every rep-volume tier uses.
 * - `'tonnage'` — pounds moved: `reps × weight_lbs × load_multiplier`, summed
 *   over the scope window. For `scope: 'set'` it's one set's reps × load.
 * - `'load'` — pounds under load on a single set
 *   (`weight_lbs × load_multiplier`) — a strength PR rather than a volume one.
 *
 * Bodyweight sets carry no `weight_lbs`, so they contribute `0` to both
 * `'tonnage'` and `'load'`.
 */
export type AchievementMeasure = 'reps' | 'tonnage' | 'load'

/**
 * One badge tier on the Trophy Room ladder (#336) — mirrors a row of
 * `public.weight_room_achievements`.
 *
 * Earned state is never stored: {@link import('@/lib/training-facility/achievements').resolveAchievements}
 * recomputes every badge (and its first-earned date) from the full set log on
 * each render, so retuning a threshold re-lights the wall immediately and a
 * backdated set retroactively earns what it should.
 */
export interface WeightRoomAchievement {
  /** UUID primary key, generated server-side. */
  id: string
  /**
   * Display name, e.g. `Century Club`. Not unique — the same label can exist
   * for several exercises; the `(exercise, scope, threshold)` triple is what's
   * unique.
   */
  label: string
  /**
   * Exercise this tier measures, matching {@link ExerciseGoal.exercise}, or
   * `null` for the pooled "all movements" ladder — reps summed across every
   * exercise for the volume scopes, days hitting *at least one* goal for
   * `'streak'`, and the best single set of any exercise for `'set'`.
   */
  exercise: string | null
  /** Which window {@link threshold} is measured over. */
  scope: AchievementScope
  /**
   * What {@link threshold} counts within that window. Absent is treated as
   * `'reps'` (every tier predating the load ladder).
   */
  measure?: AchievementMeasure
  /**
   * Value the metric must reach to earn the badge. Units follow
   * {@link measure} and {@link scope}: reps for `'reps'` (days for
   * `scope: 'streak'`), pounds for `'tonnage'` and `'load'`. Reaching it
   * exactly earns it.
   */
  threshold: number
  /**
   * Optional hex badge tint (e.g. `#EA580C`). Absent falls back to the
   * matching exercise goal's color, then to a default accent.
   */
  color?: string
  /**
   * Optional emoji shown on the badge face (e.g. `💯`). Absent renders a
   * scope-derived default glyph.
   */
  icon?: string
}

/**
 * Full Weight Room dataset — the assembled shape returned by
 * `getWeightRoomData()` / `getWeightRoomDataServer()`. `imported_at` is
 * `MAX(updated_at)` across both tables; mirrors the cardio "last
 * synced" convention so wall fixtures can show a freshness label.
 */
export interface WeightRoomData {
  /**
   * ISO timestamp of the most recent write across either table. `''`
   * when both tables are empty (the data layer returns `null` in that
   * case; this only matters when components substitute an empty
   * fallback).
   */
  imported_at: string
  /** Every logged set, sorted oldest → newest. */
  sets: StrengthSet[]
  /** Every configured exercise goal, ordered by exercise name. */
  goals: ExerciseGoal[]
  /**
   * The full movement roster (#373), ordered by slug — including archived
   * entries and movements with no daily goal, so callers can filter for
   * themselves.
   *
   * Optional because it postdates the fixtures: the demo fixture and the
   * component tests build a {@link WeightRoomData} without it, and every
   * consumer that predates the catalog ignores it. The live assembler always
   * populates it — it reads the table anyway to join
   * {@link ExerciseGoal.load_multiplier}, so surfacing it costs nothing.
   */
  exercises?: WeightRoomExercise[]
  /**
   * "Grease the groove" monthly focuses (#255), ordered newest window
   * first. Empty when none are configured. Includes past, active, and
   * upcoming focuses — callers slice by date against today.
   */
  monthly_focus: MonthlyFocus[]
}
