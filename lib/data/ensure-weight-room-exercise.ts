import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Write-side helper that guarantees a movement exists in the
 * `weight_room_exercises` roster before something foreign-keys to it (#373).
 *
 * Both `weight_room_goals` and `weight_room_monthly_focus` FK the catalog, so
 * the two admin routes that create them — the Settings "Add exercise" goal form
 * and the monthly-focus anchor — would otherwise fail with a raw `23503` for
 * any movement that isn't already in the roster. Before #373 those routes
 * *were* the thing that made an exercise loggable, so preserving that one-step
 * flow means provisioning the catalog row on their behalf.
 */

/**
 * Title-case a slug for use as a display label: `barbell-bench-press` →
 * `Barbell Bench Press`. Mirrors the `initcap(replace(slug, '-', ' '))` the
 * catalog migration uses to backfill labels, so a movement provisioned here and
 * one backfilled there read identically.
 *
 * @param slug Lowercase kebab-case exercise slug.
 */
export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Insert a catalog row for `slug` if the roster doesn't already have one.
 *
 * Uses `ignoreDuplicates` so an existing movement is left completely alone —
 * this must never overwrite a curated `equipment` / `muscle_group` /
 * `load_multiplier` just because a goal was re-saved. A provisioned row lands
 * on the deliberately neutral `other` / `full-body`, the same fallback the
 * migration uses for a movement it can't classify; the admin refines it in the
 * Settings catalog editor, where it shows up immediately.
 *
 * @param supabase Service-role client — RLS on the catalog is SELECT-only.
 * @param slug Lowercase slug, already canonicalized by the caller's Zod schema.
 * @returns `null` on success, or a human-readable message on failure.
 */
export async function ensureWeightRoomExercise(
  supabase: SupabaseClient,
  slug: string,
): Promise<string | null> {
  const { error } = await supabase.from('weight_room_exercises').upsert(
    {
      slug,
      display_name: titleCaseSlug(slug),
      equipment: 'other',
      muscle_group: 'full-body',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug', ignoreDuplicates: true },
  )
  return error === null ? null : `Failed to add '${slug}' to the movement catalog: ${error.message}`
}
