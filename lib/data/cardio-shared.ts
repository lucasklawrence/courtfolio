import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  CardioSessionRowSchema,
  CardioTrendRowSchema,
  sessionRowToCardioSession,
  trendRowToTimePoint,
} from '@/lib/schemas/cardio'
import type { CardioData } from '@/types/cardio'

/**
 * Pure cardio-read helpers shared between the browser entry
 * (`lib/data/cardio.ts`) and the server entry (`lib/data/cardio-server.ts`).
 *
 * This module deliberately imports neither the browser nor the server
 * Supabase client — only the entry files do. That keeps the assembler
 * free of `'use client'` / `'server-only'` boundaries, so importing
 * `assembleCardioData` from a Server Component doesn't drag the
 * browser client module into the server bundle (and vice versa).
 *
 * Sibling pattern: `lib/schemas/cardio.ts` (the row-shape schemas).
 */

/** Supabase tables backing the cardio dataset (#152, PRD §7.4). */
const SESSIONS_TABLE = 'cardio_sessions'
const RESTING_HR_TABLE = 'cardio_resting_hr'
const VO2MAX_TABLE = 'cardio_vo2max'

/**
 * Whitelisted column lists for each cardio table. Mirror the
 * row-shape Zod schemas in `lib/schemas/cardio.ts` so a column added
 * to the DB without a corresponding schema/type update doesn't
 * silently leak through to the dashboard.
 */
const SESSIONS_COLUMNS =
  'started_at, activity, duration_seconds, distance_meters, avg_hr, max_hr, ' +
  'pace_seconds_per_km, zone1_seconds, zone2_seconds, zone3_seconds, ' +
  'zone4_seconds, zone5_seconds, meters_per_heartbeat, updated_at'
const TREND_COLUMNS = 'date, value, updated_at'

/**
 * Validate an array of `cardio_sessions` rows after `null` → omitted
 * normalization. A schema-drift (column added without type update,
 * or hand-edited malformed row) surfaces here as a loud error rather
 * than as a confused render downstream.
 */
const CardioSessionRowsSchema = z.array(CardioSessionRowSchema)

/** Same idea as {@link CardioSessionRowsSchema} for the trend tables. */
const CardioTrendRowsSchema = z.array(CardioTrendRowSchema)

/**
 * Fetch the full cardio dataset from Supabase using the supplied
 * client. Shared between `getCardioData` (browser) and
 * `getCardioDataServer` (server) so the two read paths can't drift in
 * column whitelist, validation, or shape assembly.
 *
 * Queries the three cardio tables in parallel, normalizes Postgres
 * `null` to absent (matching the legacy JSON shape's "absent key"
 * convention), validates each table's rows against the row-shape
 * schemas in `lib/schemas/cardio.ts`, and assembles them into the
 * legacy {@link CardioData} shape that components consume.
 *
 * Returns `null` when all three tables are empty — preserves the
 * pre-Supabase contract where a missing dataset triggered the dashboard
 * empty-state branch. Components substitute an empty `CardioData`
 * fallback in that case.
 *
 * `imported_at` is computed as `MAX(updated_at)` across the three
 * tables. The import script writes `updated_at = now()` on every
 * upsert (whether the row is new or pre-existing), so this advances
 * on every re-import — preserving the legacy contract that
 * `imported_at` reflects the last sync time, not the row's birth.
 * Lexicographic comparison is safe because PostgREST serializes every
 * `timestamptz` in the same canonical UTC form
 * (`YYYY-MM-DDTHH:MM:SS.uuuuuu+00:00`), so the strings sort by actual
 * time without an explicit `Date.parse`.
 *
 * @param supabase Either the browser or the server SSR client. Both
 *   use the anon role; cardio RLS allows anon SELECT. Typed loosely
 *   as `SupabaseClient` because the project hasn't adopted
 *   `supabase gen types typescript` yet — when it does, narrow this
 *   to `SupabaseClient<Database>` for column-name autocompletion.
 * @throws when any of the three Supabase queries fail (network /
 *   misconfigured env / RLS regression) or when row-shape validation
 *   fails. Callers usually downgrade this to an empty render.
 */
export async function assembleCardioData(
  supabase: SupabaseClient,
): Promise<CardioData | null> {
  const [sessionsRes, restingRes, vo2Res] = await Promise.all([
    supabase.from(SESSIONS_TABLE).select(SESSIONS_COLUMNS).order('started_at', { ascending: true }),
    supabase.from(RESTING_HR_TABLE).select(TREND_COLUMNS).order('date', { ascending: true }),
    supabase.from(VO2MAX_TABLE).select(TREND_COLUMNS).order('date', { ascending: true }),
  ])

  if (sessionsRes.error) {
    throw new Error(`Failed to load cardio sessions: ${sessionsRes.error.message}`)
  }
  if (restingRes.error) {
    throw new Error(`Failed to load resting HR trend: ${restingRes.error.message}`)
  }
  if (vo2Res.error) {
    throw new Error(`Failed to load VO2max trend: ${vo2Res.error.message}`)
  }

  const sessionsRaw = (sessionsRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const restingRaw = (restingRes.data ?? []) as unknown as Array<Record<string, unknown>>
  const vo2Raw = (vo2Res.data ?? []) as unknown as Array<Record<string, unknown>>

  // Compute imported_at before `updated_at` is stripped — it lives on
  // every row but isn't part of the row-shape schema.
  const importedAt = computeImportedAt([sessionsRaw, restingRaw, vo2Raw])

  if (sessionsRaw.length === 0 && restingRaw.length === 0 && vo2Raw.length === 0) {
    // Preserves the pre-Supabase null-on-empty contract that detail
    // views already handle via `?? { imported_at: '', sessions: [], ... }`.
    return null
  }

  const sessionsParsed = CardioSessionRowsSchema.safeParse(
    sessionsRaw.map(stripNulls).map(stripUpdatedAt),
  )
  if (!sessionsParsed.success) {
    throw new Error(
      `cardio_sessions failed schema validation: ${sessionsParsed.error.message}`,
    )
  }
  const restingParsed = CardioTrendRowsSchema.safeParse(
    restingRaw.map(stripNulls).map(stripUpdatedAt),
  )
  if (!restingParsed.success) {
    throw new Error(
      `cardio_resting_hr failed schema validation: ${restingParsed.error.message}`,
    )
  }
  const vo2Parsed = CardioTrendRowsSchema.safeParse(
    vo2Raw.map(stripNulls).map(stripUpdatedAt),
  )
  if (!vo2Parsed.success) {
    throw new Error(`cardio_vo2max failed schema validation: ${vo2Parsed.error.message}`)
  }

  return {
    imported_at: importedAt,
    sessions: sessionsParsed.data.map(sessionRowToCardioSession),
    resting_hr_trend: restingParsed.data.map(trendRowToTimePoint),
    vo2max_trend: vo2Parsed.data.map(trendRowToTimePoint),
  }
}

/**
 * Postgres returns `null` for omitted optional columns, but the row
 * Zod schemas declare optional fields with `.optional()` (no
 * `.nullable()`). Map `null` → absent so Zod parses Supabase rows the
 * same way it parses freshly-imported JSON (which used absent keys,
 * never `null`).
 */
function stripNulls(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) out[key] = value
  }
  return out
}

/**
 * Drop the `updated_at` audit column before Zod-parsing. The row
 * schemas use `.strict()`, which would otherwise reject the column —
 * but we still need it on the raw row to compute `imported_at`, so
 * the caller pulls it off the un-stripped row first.
 */
function stripUpdatedAt(row: Record<string, unknown>): Record<string, unknown> {
  if (!('updated_at' in row)) return row
  const { updated_at: _ignored, ...rest } = row
  return rest
}

/**
 * Determine `imported_at` from the latest `updated_at` across the three
 * cardio tables. Returns `''` when no rows have an `updated_at` value —
 * matches the fallback components already use for the "no data yet" state.
 *
 * `updated_at` (rather than `created_at`) is the right source because the
 * import script writes `updated_at = now()` on every upsert payload, so
 * idempotent re-imports advance the timestamp and the field reflects the
 * last sync time.
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
