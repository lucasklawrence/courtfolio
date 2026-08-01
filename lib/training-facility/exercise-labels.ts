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

/** Slug → catalog label, for surfaces that iterate slugs rather than goals. */
export type ExerciseLabels = ReadonlyMap<string, string>

/**
 * Build a slug → label lookup straight from the roster.
 *
 * Needed wherever a movement can outlive its daily goal, which is a supported
 * state rather than an edge case: deleting a goal deliberately keeps its logged
 * sets (#373) and its achievement tiers, and the catalog row survives both. A
 * lookup built from `goals` alone would drop back to the slug for exactly those
 * movements — which is the bug codex caught on this PR.
 *
 * @param exercises `WeightRoomData.exercises`; absent yields an empty map, and
 *   every caller then falls back to the slug.
 */
export function buildExerciseLabels(
  exercises: readonly { slug: string; display_name: string }[] | undefined,
): ExerciseLabels {
  return new Map((exercises ?? []).map((e) => [e.slug, e.display_name]))
}

/**
 * Label for a bare slug.
 *
 * Prefers the catalog, then a goal/focus that carries the joined label, then
 * the slug itself. The catalog wins because it's the surface that still has a
 * row when the goal is gone.
 *
 * @param slug The movement slug to label.
 * @param named The goal/focus for that slug, if the caller has one.
 * @param labels Catalog lookup from {@link buildExerciseLabels}, if available.
 */
export function slugLabel(
  slug: string,
  named?: ExerciseNamed,
  labels?: ExerciseLabels,
): string {
  return labels?.get(slug) ?? named?.display_name ?? slug
}
