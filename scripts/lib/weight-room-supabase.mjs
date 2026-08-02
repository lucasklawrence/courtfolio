/**
 * Supabase writer for Apple Health strength workouts (#413).
 *
 * Separate from `cardio-supabase.mjs` on purpose: these rows go to
 * `weight_room_workouts`, and folding them into `upsertCardioData` would make a
 * function named for cardio the owner of the Weight Room's table.
 *
 * Everything here is idempotent. The export's `<Workout>` elements carry no
 * UUID — only `startDate`, `endDate`, `duration` and `sourceName` — so the
 * natural key is the instant the session began, which two lifting sessions
 * cannot share. A unique index on `(source, started_at)` backs the upsert, so
 * re-running a full import is a no-op rather than a second copy of 8.5 years of
 * history. That index is deliberately *not* partial: Postgres only infers
 * `ON CONFLICT` from a full one, and supabase-js's `onConflict` cannot restate a
 * predicate.
 */

/** Table that owns bounded Weight Room sessions (#374). */
const WORKOUTS_TABLE = 'weight_room_workouts'

/** Provenance marker for rows this module writes. Mirrors the `body_mass_trend` convention. */
export const APPLE_HEALTH_SOURCE = 'apple_health'

/** Rows per upsert request. Keeps a full 507-session import to a handful of round trips. */
const UPSERT_BATCH = 200

/**
 * Upsert Health strength workouts into `weight_room_workouts`.
 *
 * Only ever writes rows with `source = 'apple_health'`. A session recorded
 * through the app is `source = 'manual'` and is never touched — the same
 * "manual always wins" rule the body-mass import already follows.
 *
 * `location` is deliberately left null: Health does not record where a workout
 * happened, and defaulting it to `'gym'` would put an inference into the record
 * where nothing established one.
 *
 * **Upsert-only — this never deletes.** The cardio import prunes rows absent
 * from the payload, and that is right for `cardio_sessions`, which is a pure
 * mirror of the export. `weight_room_workouts` is not a mirror: an imported
 * session can *acquire* hand-authored data, because #400 attaches sets
 * transcribed from iCloud notes to exactly these rows. Deleting one is not the
 * cheap correction it looks like — `weight_room_sets.workout_id` is `ON DELETE
 * SET NULL`, so those sets would survive as undated loose volume, still
 * counting toward the daily rings while the session they documented vanished.
 * Silent, and unrecoverable without re-transcribing the note.
 *
 * The real gap pruning would have closed — a workout deleted or time-corrected
 * in Health leaving a stale row behind — is instead *reported* by
 * {@link findOrphanedStrengthSessions}, so a human decides.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @param {Array<{started_at: string, ended_at: string, duration_seconds: number,
 *   avg_hr?: number|null, max_hr?: number|null}>} sessions Validated strength
 *   sessions from `CardioDataSchema`'s `strength_sessions`.
 * @returns {Promise<{ upserted: number }>} How many rows were sent.
 * @throws when any batch fails, naming the Supabase error.
 */
export async function upsertStrengthSessions(supabase, sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return { upserted: 0 }
  }

  // Guard against a duplicated start inside one payload. The DB would reject
  // the whole batch on the unique index, and the message ("duplicate key") is a
  // long way from the cause, so collapse them here where the reason is
  // obvious. Later wins — the export is chronological and a repeat means the
  // same session was written twice.
  const byStart = new Map()
  for (const session of sessions) {
    byStart.set(session.started_at, session)
  }

  const rows = [...byStart.values()].map(session => ({
    started_at: session.started_at,
    ended_at: session.ended_at,
    source: APPLE_HEALTH_SOURCE,
    avg_hr: session.avg_hr ?? null,
    max_hr: session.max_hr ?? null,
  }))

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase
      .from(WORKOUTS_TABLE)
      .upsert(batch, { onConflict: 'source,started_at' })
    if (error) {
      throw new Error(
        `Failed to upsert strength sessions (batch ${i / UPSERT_BATCH + 1}): ${error.message}`
      )
    }
  }

  return { upserted: rows.length }
}

/**
 * Find imported sessions in the database that this export no longer contains.
 *
 * The reconciliation half of the import, and deliberately read-only. A workout
 * deleted in Apple Health, or one whose start time was corrected (which
 * produces a *new* row at the new instant and strands the old one), would
 * otherwise sit in the history forever with nothing to point it out.
 *
 * Reporting rather than pruning because these rows are not disposable — see
 * {@link upsertStrengthSessions}. What to do about an orphan depends on whether
 * it has sets attached, which is a judgement call, so the script names them and
 * stops.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase Service-role client.
 * @param {Array<{started_at: string}>} sessions The sessions this export carries.
 * @returns {Promise<string[]>} `started_at` of every stored imported session
 *   absent from the payload, oldest first. Empty when the two agree, and empty
 *   when the payload is empty — an import that carried no strength sessions is
 *   no evidence that the stored ones are stale.
 * @throws when the read fails.
 */
export async function findOrphanedStrengthSessions(supabase, sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []

  const { data, error } = await supabase
    .from(WORKOUTS_TABLE)
    .select('started_at')
    .eq('source', APPLE_HEALTH_SOURCE)
  if (error) {
    throw new Error(`Failed to read existing strength sessions: ${error.message}`)
  }

  // Compared as instants, not strings: Postgres renders timestamptz in its own
  // canonical form, which will not be byte-identical to the offset-bearing ISO
  // the preprocessor emits for the very same moment.
  const inExport = new Set(
    sessions.map(s => new Date(s.started_at).getTime()).filter(Number.isFinite)
  )

  return (data ?? [])
    .map(row => row.started_at)
    .filter(startedAt => {
      const t = new Date(startedAt).getTime()
      return Number.isFinite(t) && !inExport.has(t)
    })
    .sort()
}
