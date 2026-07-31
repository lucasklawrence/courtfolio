/**
 * Pure helpers for the History view's exercise-filter URL contract (#367).
 *
 * Lives *without* a `'use client'` directive — same reasoning as
 * `preview-param.ts`: a `'use client'` module makes every export a client
 * reference, which a Server Component can't call. Keeping the parse/serialize
 * pair here means the server page and the client chip island agree on the
 * contract by construction rather than by convention.
 *
 * Contract, in three states:
 *
 * - **Param absent** — everything is selected. Keeps the default view's URL
 *   clean, and means an exercise added later is included by default rather
 *   than excluded by an older link.
 * - **`?exercises=pushups,pullups`** — exactly those.
 * - **`?exercises=`** (present, empty) — deliberately *nothing*. Distinct from
 *   absent, so deselecting every chip survives a reload instead of silently
 *   resetting to all.
 *
 * Unknown names are dropped on parse, so a stale link naming a since-deleted
 * exercise degrades to the remaining valid ones.
 */

/** URL param key carrying the comma-separated selection. */
export const EXERCISE_FILTER_PARAM = 'exercises'

/**
 * Resolve the selected exercises from a raw URL param value.
 *
 * @param raw The param value: `searchParams.get('exercises')` on the client,
 *   or `searchParams.exercises` on the server (where a repeated key arrives as
 *   an array — only the first entry is read, matching client behavior).
 * @param available Every exercise the page can render, in render order. Also
 *   the whitelist: anything not in here is ignored.
 * @returns The selected subset, in `available` order. Returns **all** of
 *   `available` only when the param is *absent* — no filter means no
 *   filtering. A present-but-empty param returns `[]`, which the UI renders as
 *   its empty state; that round-trips
 *   {@link serializeExerciseSelection}'s encoding of "nothing selected".
 */
export function parseExerciseSelection(
  raw: string | string[] | null | undefined,
  available: readonly string[],
): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === null || value === undefined) return [...available]
  if (value.trim() === '') return []

  const requested = new Set(
    value
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name !== ''),
  )
  return available.filter((name) => requested.has(name.toLowerCase()))
}

/**
 * Encode a selection back into a param value.
 *
 * @param selected The chosen exercises.
 * @param available Every exercise the page can render.
 * @returns `null` when everything is selected — the caller should *remove* the
 *   param rather than write an exhaustive list, so the default view's URL stays
 *   clean and a later-added exercise is included by default instead of being
 *   silently excluded by a stale link.
 */
export function serializeExerciseSelection(
  selected: readonly string[],
  available: readonly string[],
): string | null {
  if (selected.length === available.length) return null
  return selected.join(',')
}

/**
 * Toggle one exercise in a selection, preserving `available` order.
 *
 * @param selected Current selection.
 * @param exercise Exercise to add or remove.
 * @param available Every exercise the page can render; defines result order.
 */
export function toggleExercise(
  selected: readonly string[],
  exercise: string,
  available: readonly string[],
): string[] {
  const next = new Set(selected)
  if (next.has(exercise)) next.delete(exercise)
  else next.add(exercise)
  return available.filter((name) => next.has(name))
}
