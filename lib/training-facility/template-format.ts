import type { TemplateSlot } from '@/types/weight-room'

/**
 * Display helpers for workout-template prescriptions (#375).
 *
 * Pure string formatting, kept out of the components so the awkward cases —
 * AMRAP, ranges on either axis, a drop set's descending loads — are
 * unit-testable rather than only visible by clicking through the builder.
 */

/**
 * Format a slot's set count: `4`, or `4-5` when it's a range.
 *
 * @param slot The slot to describe.
 */
export function formatSetCount(
  slot: Pick<TemplateSlot, 'target_sets' | 'target_sets_max'>
): string {
  const max = slot.target_sets_max
  return max != null && max !== slot.target_sets
    ? `${slot.target_sets}-${max}`
    : `${slot.target_sets}`
}

/**
 * Format a slot's rep prescription, or `null` when there isn't one.
 *
 * Absent `target_reps` is **not** zero and not an omission to paper over — it
 * means the prescription is "as many as you can", which is a real instruction
 * for dips and pullups, and also how a transcribed template that only recorded
 * set counts arrives. Callers render {@link AMRAP_LABEL} for the null.
 *
 * @param slot The slot to describe.
 */
export function formatRepRange(
  slot: Pick<TemplateSlot, 'target_reps' | 'target_reps_max'>
): string | null {
  if (slot.target_reps == null) return null
  const max = slot.target_reps_max
  return max != null && max !== slot.target_reps
    ? `${slot.target_reps}-${max}`
    : `${slot.target_reps}`
}

/** What a slot with no rep target reads as. */
export const AMRAP_LABEL = 'to failure'

/**
 * One-line prescription for a slot — the string the builder and the recording
 * surface both show under a movement name.
 *
 * Shapes it produces:
 * - `4 × 5` — the ordinary case
 * - `4-5 × 8-12` — ranges on either axis
 * - `4 × to failure` — no rep target
 * - `4 × 5 @ 185 lb` — with a prescribed load
 * - `2 × to failure · 35 → 30 → 25 → 20 lb` — a drop set, loads from its steps
 *
 * Load is per implement, matching `weight_room_sets.weight_lbs`, so this is
 * deliberately *not* multiplied by the movement's `load_multiplier` — the
 * number shown is the one read off the dumbbell.
 *
 * @param slot The slot to describe, including its steps.
 */
export function formatSlotPrescription(slot: TemplateSlot): string {
  const reps = formatRepRange(slot) ?? AMRAP_LABEL
  let line = `${formatSetCount(slot)} × ${reps}`

  if (slot.target_weight_lbs != null) {
    line += ` @ ${formatWeight(slot.target_weight_lbs)} lb`
  }

  // A drop set's loads live on its steps, so surface them instead of the
  // slot's single (usually absent) weight.
  const stepLoads = slot.steps
    .map(step => step.target_weight_lbs)
    .filter((w): w is number => w != null)
  if (stepLoads.length > 0) {
    line += ` · ${stepLoads.map(formatWeight).join(' → ')} lb`
  }

  return line
}

/**
 * Trim a trailing `.0` off a numeric load so `35` doesn't render as `35.0`,
 * while `2.5` keeps its half.
 *
 * @param weight Pounds on one implement.
 */
function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? `${weight}` : `${weight}`.replace(/0+$/, '')
}

/**
 * Whether a slot's within-set sequence is a **superset** rather than a drop
 * set — true when any step names its own movement.
 *
 * The two share a table and a shape but are different training intents, so
 * surfaces should label them differently rather than calling both "steps".
 *
 * @param slot The slot to classify.
 */
export function isSuperset(slot: Pick<TemplateSlot, 'steps'>): boolean {
  return slot.steps.some(step => step.exercise != null)
}
