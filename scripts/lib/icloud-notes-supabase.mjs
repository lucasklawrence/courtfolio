/**
 * Supabase writer for workouts transcribed from Apple Notes (#400).
 *
 * Kept apart from `weight-room-supabase.mjs` for the same reason that file is
 * kept apart from the cardio writer: that one owns the Apple Health half of
 * `weight_room_workouts`, this one owns the sets that attach to it, and folding
 * them together would put two very different idempotency stories behind one
 * name.
 *
 * Everything here is upsert-only. Nothing this module writes ever deletes a
 * row — an imported session may already carry Health-derived duration and heart
 * rate that this import has no business overwriting, and a set logged in the
 * app is not ours to touch.
 */

/** Table that owns bounded Weight Room sessions (#374). */
const WORKOUTS_TABLE = 'weight_room_workouts'

/** Table that owns individual logged sets (#79). */
const SETS_TABLE = 'weight_room_sets'

/** Provenance marker for rows this module writes. */
export const ICLOUD_NOTES_SOURCE = 'icloud_notes'

/** Rows per upsert request. */
const UPSERT_BATCH = 200

/**
 * Read the stored strength sessions a set of notes could attribute to.
 *
 * Scoped to a date range rather than reading all 507, because the notes cover
 * about two years of an eight-year history and pulling the rest only widens the
 * field of things a note can be matched to by mistake.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @param {string} fromIso Inclusive lower bound, ISO instant.
 * @param {string} toIso Exclusive upper bound, ISO instant.
 * @returns {Promise<Array<{id: string, started_at: string, ended_at: string|null, source: string}>>}
 * @throws when the read fails.
 */
export async function fetchSessionsInRange(supabase, fromIso, toIso) {
  const { data, error } = await supabase
    .from(WORKOUTS_TABLE)
    .select('id, started_at, ended_at, source')
    .gte('started_at', fromIso)
    .lt('started_at', toIso)
    .order('started_at')
  if (error) {
    throw new Error(`Failed to read existing sessions: ${error.message}`)
  }
  return data ?? []
}

/**
 * Create (or re-find) the session row for a note that matched no Health workout.
 *
 * The residue case: a session the watch missed. `(source, started_at)` is
 * unique, and `started_at` comes from the note's own creation stamp, so
 * re-running converges on the same row rather than minting a second one.
 *
 * `location` is left null deliberately — the note does not say where it
 * happened, and defaulting to `'gym'` would record an inference as a fact.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @param {{startedAt: string, endedAt: string, title: string}} note The note's
 *   window and title; the title becomes the session title, which is how the
 *   template that was run stays visible on the imported session.
 * @returns {Promise<string>} The session's id.
 * @throws when the upsert or the follow-up read fails.
 */
export async function upsertNoteSession(supabase, { startedAt, endedAt, title }) {
  const { data, error } = await supabase
    .from(WORKOUTS_TABLE)
    .upsert(
      {
        started_at: startedAt,
        ended_at: endedAt,
        title,
        source: ICLOUD_NOTES_SOURCE,
      },
      { onConflict: 'source,started_at' }
    )
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to upsert session for "${title}" at ${startedAt}: ${error.message}`)
  }
  return data.id
}

/**
 * Upsert transcribed sets.
 *
 * Keyed on `import_key`, which the parser mints deterministically from the note
 * identity and the set's position within it. That is what makes a second run of
 * a two-year import converge instead of doubling it.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @param {Array<{logged_at: string, exercise: string, reps: number,
 *   weight_lbs: number|null, workout_id: string|null, position: number|null,
 *   import_key: string}>} rows Sets to write.
 * @returns {Promise<{upserted: number}>} How many rows were sent.
 * @throws when any batch fails, naming the Supabase error.
 */
export async function upsertNoteSets(supabase, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { upserted: 0 }

  // Collapse a duplicated key inside one payload. The database would reject the
  // whole batch on the unique index, and "duplicate key" is a long way from the
  // cause, so fail here where the note and movement are still in hand.
  const byKey = new Map()
  for (const row of rows) {
    if (byKey.has(row.import_key)) {
      throw new Error(
        `Two sets share the import key "${row.import_key}" — the note identity is not unique.`
      )
    }
    byKey.set(row.import_key, { ...row, source: ICLOUD_NOTES_SOURCE })
  }

  const prepared = [...byKey.values()]
  for (let i = 0; i < prepared.length; i += UPSERT_BATCH) {
    const batch = prepared.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase.from(SETS_TABLE).upsert(batch, { onConflict: 'import_key' })
    if (error) {
      throw new Error(
        `Failed to upsert sets (batch ${Math.floor(i / UPSERT_BATCH) + 1}): ${error.message}`
      )
    }
  }

  return { upserted: prepared.length }
}

/**
 * Read the movement catalog's load multipliers.
 *
 * Taken live rather than hardcoded so a `Weight (total)` column is halved by
 * the number of implements the catalog actually records for that movement — if
 * someone corrects a multiplier later, the importer follows.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @returns {Promise<Record<string, number>>} Multipliers keyed by slug.
 * @throws when the read fails.
 */
export async function fetchLoadMultipliers(supabase) {
  const { data, error } = await supabase
    .from('weight_room_exercises')
    .select('slug, load_multiplier')
  if (error) {
    throw new Error(`Failed to read the movement catalog: ${error.message}`)
  }
  return Object.fromEntries((data ?? []).map(row => [row.slug, row.load_multiplier]))
}

/**
 * The catalog slugs that exist, for validating what the parser resolved.
 *
 * `weight_room_sets.exercise` is a foreign key onto this catalog, so a slug the
 * parser invented fails the insert with a `23503` a long way from its cause.
 * Checking up front lets the importer name the movement and the note instead.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @returns {Promise<Set<string>>} Every catalog slug.
 * @throws when the read fails.
 */
export async function fetchExerciseSlugs(supabase) {
  const { data, error } = await supabase.from('weight_room_exercises').select('slug')
  if (error) {
    throw new Error(`Failed to read the movement catalog: ${error.message}`)
  }
  return new Set((data ?? []).map(row => row.slug))
}
