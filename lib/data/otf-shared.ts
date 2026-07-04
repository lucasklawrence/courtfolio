import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { OtfSessionRowSchema, otfRowToSession } from '@/lib/schemas/otf'
import type { OtfData } from '@/types/otf'

/**
 * Pure OTF-read helper shared between the browser entry (`lib/data/otf.ts`)
 * and the server entry (`lib/data/otf-server.ts`). Like its cardio sibling
 * (`lib/data/cardio-shared.ts`), this module imports neither Supabase client
 * — only the entry files do — so importing `assembleOtfData` from a Server
 * Component doesn't drag the browser client into the server bundle (or vice
 * versa).
 */

/** Supabase table backing the OrangeTheory Gym view (#256). */
const SESSIONS_TABLE = 'otf_sessions'

/**
 * Whitelisted columns for `otf_sessions`. Kept in sync by hand with
 * {@link OtfSessionRowSchema} (which is `.strict()`), so a column added to
 * the table without updating the schema fails loudly instead of leaking to
 * the view. `updated_at` is pulled to compute `imported_at`, then stripped
 * before validation.
 */
const SESSIONS_COLUMNS =
  'started_at, coach, studio, calories, splat, steps, avg_hr, peak_hr, ' +
  'zone_gray_min, zone_blue_min, zone_green_min, zone_orange_min, zone_red_min, ' +
  'treadmill, rower, excluded, excluded_reason, class_type, class_type_override, updated_at'

/** Array form of {@link OtfSessionRowSchema} for validating the full read. */
const OtfSessionRowsSchema = z.array(OtfSessionRowSchema)

/**
 * Fetch the full OrangeTheory dataset from Supabase using the supplied
 * client. Shared between `getOtfData` (browser) and `getOtfDataServer`
 * (server) so the read shape, column whitelist, and validation can't drift.
 *
 * Returns `null` when the table is empty — preserves the same "no data yet"
 * contract the cardio views use, so the OTF view can fall back to an empty
 * render / empty-state branch.
 *
 * `imported_at` is `MAX(updated_at)` across the rows. Lexicographic string
 * compare is safe because PostgREST serializes every `timestamptz` in the
 * same canonical UTC form, so the strings sort by actual time.
 *
 * @param supabase Browser or server SSR client (both anon role; otf RLS
 *   allows anon SELECT).
 * @throws when the Supabase query fails (network / misconfig / RLS
 *   regression) or when row-shape validation fails. Callers usually
 *   downgrade this to an empty render.
 */
export async function assembleOtfData(supabase: SupabaseClient): Promise<OtfData | null> {
  const res = await supabase
    .from(SESSIONS_TABLE)
    .select(SESSIONS_COLUMNS)
    .order('started_at', { ascending: true })

  if (res.error) {
    throw new Error(`Failed to load OTF sessions: ${res.error.message}`)
  }

  const raw = (res.data ?? []) as unknown as Array<Record<string, unknown>>
  if (raw.length === 0) {
    // Preserves the null-on-empty contract the view's empty-state handles.
    return null
  }

  const importedAt = computeImportedAt(raw)

  const parsed = OtfSessionRowsSchema.safeParse(raw.map(stripNulls).map(stripUpdatedAt))
  if (!parsed.success) {
    throw new Error(`otf_sessions failed schema validation: ${parsed.error.message}`)
  }

  return {
    imported_at: importedAt,
    sessions: parsed.data.map(otfRowToSession),
  }
}

/**
 * Postgres returns `null` for omitted optional columns, but the row schema
 * declares optional fields with `.optional()` (no `.nullable()`). Map `null`
 * → absent so Zod parses Supabase rows the same way it parses the importer's
 * absent-key payloads.
 */
function stripNulls(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) out[key] = value
  }
  return out
}

/**
 * Drop the `updated_at` audit column before Zod-parsing — the row schema is
 * `.strict()` and would reject it — but only after {@link computeImportedAt}
 * has read it off the raw row.
 */
function stripUpdatedAt(row: Record<string, unknown>): Record<string, unknown> {
  if (!('updated_at' in row)) return row
  const { updated_at: _ignored, ...rest } = row
  return rest
}

/**
 * Determine `imported_at` from the latest `updated_at` across the rows.
 * Returns `''` when no row carries an `updated_at`. Lexicographic compare is
 * valid on PostgREST's canonical UTC `timestamptz` serialization.
 */
function computeImportedAt(rows: Array<Record<string, unknown>>): string {
  let latest = ''
  for (const row of rows) {
    const value = row.updated_at
    if (typeof value === 'string' && value > latest) latest = value
  }
  return latest
}
