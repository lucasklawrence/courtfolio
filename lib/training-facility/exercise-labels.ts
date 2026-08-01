/**
 * Human-readable movement labels (#384).
 *
 * The Weight Room stores movements by slug — `barbell-bench-press` — because
 * the slug is the primary key and the FK target for every set. The catalog
 * (`weight_room_exercises`) owns the label that should be *shown*, and the data
 * layer joins it onto {@link ExerciseGoal} and {@link MonthlyFocus} on read, so
 * render sites resolve it from the object they already hold rather than
 * carrying the roster around.
 *
 * These helpers exist so the fallback is written once. Every surface degrades
 * to the slug when the catalog has no row — the pre-#384 behavior — rather than
 * rendering an empty name.
 */

/**
 * Anything carrying a movement slug and an optionally-joined catalog label —
 * {@link import('@/types/weight-room').ExerciseGoal} and
 * {@link import('@/types/weight-room').MonthlyFocus} both satisfy it.
 */
export interface ExerciseNamed {
  /** Movement slug; the stored identity. */
  exercise: string
  /** Catalog label, joined on read. Absent falls back to {@link exercise}. */
  display_name?: string
}

/**
 * Label to render for a goal or focus.
 *
 * Identity (test IDs, React keys, URL tokens, `data-*` attributes) must keep
 * using `.exercise` — this is for human-facing text and accessible names only.
 */
export function exerciseLabel(named: ExerciseNamed): string {
  return named.display_name ?? named.exercise
}

/**
 * Label for a bare slug, given the catalog-joined record for it if one exists.
 *
 * For surfaces that iterate raw slugs — a day's sets, the filter chips — rather
 * than goal objects.
 *
 * @param slug The movement slug to label.
 * @param named The goal/focus for that slug, if the caller has one.
 */
export function slugLabel(slug: string, named?: ExerciseNamed): string {
  return named?.display_name ?? slug
}
