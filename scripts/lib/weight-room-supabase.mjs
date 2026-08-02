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
 * cannot share. A partial unique index on `(source, started_at) where source <>
 * 'manual'` backs the upsert, so re-running a full import is a no-op rather
 * than a second copy of 8.5 years of history.
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
 * Only ever touches rows with `source = 'apple_health'`. A session recorded
 * through the app is `source = 'manual'` and is never read, updated or pruned
 * here — the same "manual always wins" rule the body-mass import already
 * follows, and the reason the unique index excludes manual rows.
 *
 * `location` is deliberately left null: Health does not record where a workout
 * happened, and defaulting it to `'gym'` would put an inference into the record
 * where nothing established one.
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
