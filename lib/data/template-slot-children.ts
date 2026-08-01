import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Write-side helper for a template slot's children — its within-set steps and
 * its pre-declared alternates (#375).
 *
 * Both are replaced **wholesale** rather than edited in place, which is safe
 * precisely because neither is referenced from outside its slot: recreating
 * their rows loses nothing. Slot ids are the opposite case — `#376` links
 * logged sets to them via `weight_room_sets.template_slot_id`, so slots are
 * edited in place and never recreated, or adherence history would be orphaned
 * every time a template was touched.
 *
 * Lives outside the route files because a Next.js route module should export
 * only its handlers.
 */

/** Postgres FK violation — an exercise slug that isn't in the catalog. */
const FK_VIOLATION = '23503'

/** One step in a slot write body, post-validation. */
export interface SlotStepInput {
  /** Absent/null inherits the slot's movement (drop set); set makes it a superset. */
  exercise?: string | null
  /** Reps for this step; absent inherits the slot's. */
  target_reps?: number
  /** Load on one implement for this step. */
  target_weight_lbs?: number
  /** Free-text cue. */
  notes?: string | null
}

/** Outcome of a child write: `null` on success, else a message and status. */
export interface ChildWriteFailure {
  /** Human-readable message, safe to return to the caller. */
  message: string
  /** HTTP status the route should answer with. */
  status: number
}

/**
 * Replace a slot's steps and alternates.
 *
 * Each list is only touched when supplied — passing `undefined` leaves that
 * child list exactly as it was, so a PATCH that renames a slot doesn't wipe its
 * alternates.
 *
 * @param supabase Service-role client.
 * @param slotId Slot whose children are being replaced.
 * @param steps New within-set sequence, in array order; `undefined` leaves it alone.
 * @param alternates New swap slugs in preference order; `undefined` leaves it alone.
 * @returns `null` on success, or a {@link ChildWriteFailure} to surface.
 */
export async function replaceSlotChildren(
  supabase: SupabaseClient,
  slotId: string,
  steps: readonly SlotStepInput[] | undefined,
  alternates: readonly string[] | undefined,
): Promise<ChildWriteFailure | null> {
  const nowIso = new Date().toISOString()

  if (steps !== undefined) {
    const { error: clearError } = await supabase
      .from('weight_room_template_slot_steps')
      .delete()
      .eq('slot_id', slotId)
    if (clearError) {
      return { message: `Failed to clear steps: ${clearError.message}`, status: 500 }
    }

    if (steps.length > 0) {
      const rows = steps.map((step, index) => {
        const row: Record<string, unknown> = {
          slot_id: slotId,
          position: index,
          updated_at: nowIso,
        }
        if (step.exercise != null) row.exercise = step.exercise
        if (step.target_reps != null) row.target_reps = step.target_reps
        if (step.target_weight_lbs != null) row.target_weight_lbs = step.target_weight_lbs
        if (step.notes != null) row.notes = step.notes
        return row
      })
      const { error } = await supabase.from('weight_room_template_slot_steps').insert(rows)
      if (error) {
        if (error.code === FK_VIOLATION) {
          return {
            message: 'A step names an exercise that is not in the movement catalog.',
            status: 409,
          }
        }
        return { message: `Failed to write steps: ${error.message}`, status: 500 }
      }
    }
  }

  if (alternates !== undefined) {
    const { error: clearError } = await supabase
      .from('weight_room_template_alternates')
      .delete()
      .eq('slot_id', slotId)
    if (clearError) {
      return { message: `Failed to clear alternates: ${clearError.message}`, status: 500 }
    }

    // De-duplicated because `(slot_id, exercise)` is unique — a builder that
    // listed the same swap twice should get one row, not a 409.
    const unique = [...new Set(alternates)]
    if (unique.length > 0) {
      const rows = unique.map((exercise, index) => ({
        slot_id: slotId,
        exercise,
        position: index,
        updated_at: nowIso,
      }))
      const { error } = await supabase.from('weight_room_template_alternates').insert(rows)
      if (error) {
        if (error.code === FK_VIOLATION) {
          return {
            message: 'An alternate names an exercise that is not in the movement catalog.',
            status: 409,
          }
        }
        return { message: `Failed to write alternates: ${error.message}`, status: 500 }
      }
    }
  }

  return null
}
