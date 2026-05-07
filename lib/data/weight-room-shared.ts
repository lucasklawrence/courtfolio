import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  WeightRoomGoalRowSchema,
  WeightRoomSetRowSchema,
  goalRowToExerciseGoal,
  setRowToStrengthSet,
} from '@/lib/schemas/weight-room'
import type { WeightRoomData } from '@/types/weight-room'

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

/** Whitelisted column lists for each table; `updated_at` rides along for `imported_at` computation. */
const SETS_COLUMNS = 'id, logged_at, exercise, reps, updated_at'
const GOALS_COLUMNS = 'exercise, daily_target, color, updated_at'

const WeightRoomSetRowsSchema = z.array(WeightRoomSetRowSchema)
const WeightRoomGoalRowsSchema = z.array(WeightRoomGoalRowSchema)

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
  const [setsRes, goalsRes] = await Promise.all([
    supabase.from(SETS_TABLE).select(SETS_COLUMNS).order('logged_at', { ascending: true }),
    supabase.from(GOALS_TABLE).select(GOALS_COLUMNS).order('exercise', { ascending: true }),
  ])

  if (setsRes.error) {
    throw new Error(`Failed to load weight room sets: ${setsRes.error.message}`)
  }
  if (goalsRes.error) {
    throw new Error(`Failed to load weight room goals: ${goalsRes.error.message}`)
  }

  const setsRaw = (setsRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const goalsRaw = (goalsRes.data ?? []) as unknown as Array<Record<string, unknown>>

  // Compute imported_at before stripping `updated_at` — that column lives
  // on every row but isn't part of the row-shape schema (`.strict()`
  // would reject it).
  const importedAt = computeImportedAt([setsRaw, goalsRaw])

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

  return {
    imported_at: importedAt,
    sets: setsParsed.data.map(setRowToStrengthSet),
    goals: goalsParsed.data.map(goalRowToExerciseGoal),
  }
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
