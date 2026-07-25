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
   * Exercise name (`pushups`, `pullups`, …). Foreign-keyed to
   * {@link ExerciseGoal.exercise}; deleting a goal cascades sets.
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
  /** Which metric {@link threshold} applies to. */
  scope: AchievementScope
  /**
   * Value the scope's metric must reach to earn the badge — reps for every
   * scope except `'streak'`, which counts days. Reaching it exactly earns it.
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
   * "Grease the groove" monthly focuses (#255), ordered newest window
   * first. Empty when none are configured. Includes past, active, and
   * upcoming focuses — callers slice by date against today.
   */
  monthly_focus: MonthlyFocus[]
}
