import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { BenchmarkSchema } from '@/lib/schemas/movement'
import type { Benchmark } from '@/types/movement'

/**
 * Pure movement-benchmark read helpers shared between the browser entry
 * (`lib/data/movement.ts`) and the server entry (`lib/data/movement-server.ts`).
 *
 * Split out in #345, when the Combine's track and treadmill views moved to
 * server reads: a client component importing the browser Supabase client
 * inlines `NEXT_PUBLIC_SUPABASE_ANON_KEY` into its bundle, which is not
 * acceptable on a publicly reachable route.
 *
 * Mirrors the assembler pattern already used by `cardio-shared.ts`,
 * `otf-shared.ts`, and `weight-room-shared.ts`: this module imports neither
 * Supabase client, so importing it from a Server Component can't drag the
 * browser client into the server bundle (or vice versa). Only the entry files
 * own the client wiring.
 *
 * Writes deliberately stay in `movement.ts` — they go through the admin-gated
 * API routes from the browser and have no server-side caller.
 */

/** Supabase table containing benchmark rows. Created via migration in #131. */
export const MOVEMENT_TABLE = 'movement_benchmarks'

/**
 * Whitelisted column list for benchmark reads. Mirrors the {@link Benchmark}
 * shape so a future column addition (e.g. a `bench_press_lbs` field) doesn't
 * silently leak through to consumers without a corresponding type update.
 */
export const MOVEMENT_SELECT_COLUMNS =
  'date, bodyweight_lbs, shuttle_5_10_5_s, vertical_in, sprint_10y_s, notes, is_complete'

/**
 * Validates an array of rows returned from the Supabase select. Each row is
 * normalized (null → omitted) and then run through the canonical
 * {@link BenchmarkSchema} so a DB-shape drift (e.g. a future column added
 * without updating the type, or a hand-edited malformed row) surfaces as a
 * loud error instead of silently flowing into the public UI.
 */
const BenchmarkRowsSchema = z
  .array(BenchmarkSchema)
  .describe('movement_benchmarks rows after null-stripping')

/**
 * Fetch all logged Combine benchmarks using the supplied client, newest date
 * first. Shared between the browser and server entries so the column
 * whitelist, ordering, and validation can't drift between them.
 *
 * Returns an empty array when no rows exist (typical pre-baseline state).
 *
 * @param supabase Browser or server SSR client — both use the anon role, and
 *   `movement_benchmarks` RLS allows anon SELECT.
 * @throws when the Supabase query fails (network error, misconfigured env) or
 *   when a row fails Zod validation. Callers usually downgrade this to an
 *   empty render.
 */
export async function assembleMovementBenchmarks(supabase: SupabaseClient): Promise<Benchmark[]> {
  const { data, error } = await supabase
    .from(MOVEMENT_TABLE)
    .select(MOVEMENT_SELECT_COLUMNS)
    .order('date', { ascending: false })
  if (error) {
    throw new Error(`Failed to load movement benchmarks: ${error.message}`)
  }
  const stripped = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(stripNulls)
  const parsed = BenchmarkRowsSchema.safeParse(stripped)
  if (!parsed.success) {
    throw new Error(`Movement benchmarks failed schema validation: ${parsed.error.message}`)
  }
  return parsed.data
}

/**
 * Postgres returns `null` for omitted optional columns, but the
 * {@link Benchmark} type and {@link BenchmarkSchema} declare fields as
 * `T | undefined` (via `?:` / `.optional()`). Map `null` → omitted so
 * downstream validation accepts the row the same way it accepts the legacy
 * JSON shape (which used absent keys, never `null`).
 */
function stripNulls(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) out[key] = value
  }
  return out
}
