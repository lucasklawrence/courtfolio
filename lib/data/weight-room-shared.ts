import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  WeightRoomAchievementRowSchema,
  WeightRoomGoalRowSchema,
  WeightRoomMonthlyFocusRowSchema,
  WeightRoomSetRowSchema,
  achievementRowToAchievement,
  focusRowToMonthlyFocus,
  goalRowToExerciseGoal,
  setRowToStrengthSet,
} from '@/lib/schemas/weight-room'
import type { WeightRoomAchievement, WeightRoomData } from '@/types/weight-room'

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

/** Whitelisted column lists for each table; `updated_at` rides along for `imported_at` computation. */
const SETS_COLUMNS = 'id, logged_at, exercise, reps, weight_lbs, variant, updated_at'
const GOALS_COLUMNS = 'exercise, daily_target, color, kind, updated_at'
const FOCUS_COLUMNS =
  'id, exercise, daily_target, target_kind, color, category, start_date, end_date, updated_at'

const WeightRoomSetRowsSchema = z.array(WeightRoomSetRowSchema)
const WeightRoomGoalRowsSchema = z.array(WeightRoomGoalRowSchema)
const WeightRoomMonthlyFocusRowsSchema = z.array(WeightRoomMonthlyFocusRowSchema)

/** Supabase table backing the Trophy Room achievement ladder (#336). */
const ACHIEVEMENTS_TABLE = 'weight_room_achievements'

/** Whitelisted columns for `weight_room_achievements`, in sync with {@link WeightRoomAchievementRowSchema}. */
const ACHIEVEMENTS_COLUMNS = 'id, label, exercise, scope, threshold, color, icon'

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
  supabase: SupabaseClient,
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
    throw new Error(
      `weight_room_achievements failed schema validation: ${parsed.error.message}`,
    )
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
  supabase: SupabaseClient,
): Promise<WeightRoomData | null> {
  // Secondary sort keys make ties deterministic (#229): backdated sets
  // all stamp local noon of their day, so `logged_at` alone left their
  // relative order unstable between fetches. `updated_at` resolves ties
  // by insertion order (sets have no update path), and `id` backstops
  // same-transaction inserts whose `updated_at` also collides.
  const [setsRaw, goalsRes, focusRes] = await Promise.all([
    // Paged — the set log is the one table here that grows without bound and
    // it crossed PostgREST's row cap in July 2026. See {@link fetchAllRows}.
    fetchAllRows(
      SETS_TABLE,
      (from, to) =>
        supabase
          .from(SETS_TABLE)
          .select(SETS_COLUMNS)
          .order('logged_at', { ascending: true })
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'Failed to load weight room sets',
    ),
    supabase.from(GOALS_TABLE).select(GOALS_COLUMNS).order('exercise', { ascending: true }),
    // Newest window first so the "Upcoming"/roadmap UI can slice from
    // the head without re-sorting.
    supabase.from(FOCUS_TABLE).select(FOCUS_COLUMNS).order('start_date', { ascending: false }),
  ])

  if (goalsRes.error) {
    throw new Error(`Failed to load weight room goals: ${goalsRes.error.message}`)
  }
  if (focusRes.error) {
    throw new Error(`Failed to load weight room monthly focus: ${focusRes.error.message}`)
  }

  const goalsRaw = (goalsRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const focusRaw = (focusRes.data ?? []) as unknown as Array<Record<string, unknown>>

  // Compute imported_at before stripping `updated_at` — that column lives
  // on every row but isn't part of the row-shape schema (`.strict()`
  // would reject it).
  const importedAt = computeImportedAt([setsRaw, goalsRaw, focusRaw])

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
      `weight_room_monthly_focus failed schema validation: ${focusParsed.error.message}`,
    )
  }

  return {
    imported_at: importedAt,
    sets: setsParsed.data.map(setRowToStrengthSet),
    goals: goalsParsed.data.map(goalRowToExerciseGoal),
    monthly_focus: focusParsed.data.map(focusRowToMonthlyFocus),
  }
}

/**
 * Rows requested per page. PostgREST caps a single response at the project's
 * `max-rows` setting (1000 on Supabase by default), so this is an upper bound
 * on what one request can return, not a guarantee.
 */
const PAGE_SIZE = 1000

/**
 * Safety bound on total rows pulled, so a pathological response (a server that
 * keeps returning full pages) can't spin forever. Far above any realistic set
 * count — ~137 years of logging at 20 sets/day.
 */
const MAX_ROWS = 1_000_000

/**
 * Fetch every row of a table by walking `.range()` windows until a page comes
 * back empty.
 *
 * WHY: PostgREST silently truncates an unbounded `select()` at the project's
 * `max-rows` (1000). It returns 200 with a short body rather than erroring, so
 * the overflow is invisible to the caller — `weight_room_sets` crossed 1000
 * rows in July 2026 and the read started silently dropping the *newest* sets
 * (the query is ordered oldest-first), quietly under-reporting today's rings,
 * the heatmap, lifetime totals, and streaks.
 *
 * A page shorter than {@link PAGE_SIZE} ends the walk, so the common
 * under-the-cap case costs exactly one request. That termination rule assumes
 * the server's `max-rows` is not *below* {@link PAGE_SIZE} — which holds
 * because PAGE_SIZE is set to Supabase's own default cap, so a full page is the
 * only ambiguous response. Lowering `max-rows` under 1000 in the project
 * settings would silently truncate again; raising it is harmless.
 *
 * The query's ordering is fully deterministic (#229: `logged_at`, `updated_at`,
 * `id`), which is what makes paging stable — an ambiguous sort could repeat or
 * skip rows across page boundaries.
 *
 * @param table Table name, used only in the error message.
 * @param page Builds the request for one `[from, to]` inclusive window.
 * @param errorPrefix Prefix for the thrown error message.
 * @throws when any page's query fails, or when {@link MAX_ROWS} is exceeded.
 */
async function fetchAllRows(
  table: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  errorPrefix: string,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const res = await page(from, from + PAGE_SIZE - 1)
    if (res.error) {
      throw new Error(`${errorPrefix}: ${res.error.message}`)
    }
    const batch = (res.data ?? []) as Array<Record<string, unknown>>
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
  throw new Error(`${errorPrefix}: ${table} exceeded the ${MAX_ROWS}-row read cap.`)
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
