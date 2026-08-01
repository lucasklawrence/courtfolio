import type { StrengthSet, TemplateSlot, WorkoutTemplate } from '@/types/weight-room'

/**
 * Pure logic for the live recording surface (#376) — how a template's
 * prescription lines up against what's actually been logged into the open
 * session so far.
 *
 * Kept out of the component so the parts that are easy to get quietly wrong —
 * what counts as a substitution, what the next set should prefill to, what
 * "extra work" means — are unit-testable rather than only observable by
 * standing in a gym.
 */

/** How one template slot is going, against what it prescribed. */
export interface SlotProgress {
  /** The slot being tracked. */
  slot: TemplateSlot
  /** Sets logged against this slot so far, oldest first. */
  sets: StrengthSet[]
  /** How many sets have been logged — may exceed the prescription. */
  logged: number
  /**
   * The movement actually being performed. Differs from `slot.exercise` once a
   * set has been logged with something else — the rack was taken.
   */
  performedExercise: string
  /**
   * Whether this slot is being performed with a movement other than the one
   * prescribed. Derived from the logged sets, never from a flag: the set rows
   * *are* the record.
   */
  isSubstituted: boolean
  /**
   * True once at least the prescribed number of sets exists. A slot with a set
   * range is complete at its floor — anything up to the ceiling is still
   * "hitting the prescription", not exceeding it.
   */
  isComplete: boolean
}

/**
 * Line a template's slots up against the sets logged into a workout.
 *
 * @param template The template being run, or `null` for a session started
 *   without one — which yields no slots, so everything logged is extra work.
 * @param workoutSets Every set belonging to the open workout.
 */
export function buildSlotProgress(
  template: WorkoutTemplate | null,
  workoutSets: readonly StrengthSet[]
): SlotProgress[] {
  if (template === null) return []

  const bySlot = new Map<string, StrengthSet[]>()
  for (const set of workoutSets) {
    if (set.template_slot_id === undefined) continue
    const list = bySlot.get(set.template_slot_id) ?? []
    list.push(set)
    bySlot.set(set.template_slot_id, list)
  }

  return [...template.slots]
    .sort((a, b) => a.position - b.position)
    .map(slot => {
      const sets = (bySlot.get(slot.id) ?? []).sort((a, b) =>
        a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : 0
      )
      // The newest set decides what's being performed: swapping mid-slot means
      // the most recent choice is the current one, and earlier sets keep the
      // movement they were actually done with.
      const performedExercise = sets.at(-1)?.exercise ?? slot.exercise
      return {
        slot,
        sets,
        logged: sets.length,
        performedExercise,
        isSubstituted: performedExercise !== slot.exercise,
        isComplete: sets.length >= slot.target_sets,
      }
    })
}

/**
 * Sets logged into the workout that no slot prescribed — the accessory work
 * added on the day.
 *
 * A set with no `template_slot_id` inside a workout is extra by definition; the
 * same absence outside a workout is just a loose grease-the-groove set, which
 * is why this only ever looks at one session's sets.
 *
 * @param workoutSets Every set belonging to the open workout.
 */
export function extraSets(workoutSets: readonly StrengthSet[]): StrengthSet[] {
  return workoutSets.filter(set => set.template_slot_id === undefined)
}

/** Prefilled values for the next set of a slot. */
export interface NextSetDefaults {
  /** Reps to prefill, or `null` when nothing sensible is known (AMRAP, no history). */
  reps: number | null
  /** Load per implement to prefill, or `null` for bodyweight / unknown. */
  weight_lbs: number | null
}

/**
 * What the next set of a slot should prefill to.
 *
 * Priority is **what you just did**, then what was prescribed. Repeating the
 * previous set is right far more often than repeating the plan: loads get
 * adjusted on the first set and then held, so after one set the prescription is
 * the stale number.
 *
 * A rep *range* prefills its floor — the honest reading of "8–12" mid-set is
 * the commitment, not the stretch. AMRAP prefills nothing rather than guessing.
 *
 * @param slot The slot being performed.
 * @param setsInSlot Sets already logged against it, oldest first.
 * @param lastElsewhere The most recent set of this movement from any earlier
 *   session, used when the slot is still empty. `null` when it has never been
 *   logged.
 */
export function nextSetDefaults(
  slot: TemplateSlot,
  setsInSlot: readonly StrengthSet[],
  lastElsewhere: StrengthSet | null = null
): NextSetDefaults {
  const previous = setsInSlot.at(-1)
  if (previous !== undefined) {
    return {
      reps: previous.reps,
      weight_lbs: previous.weight_lbs ?? null,
    }
  }

  return {
    reps: slot.target_reps ?? lastElsewhere?.reps ?? null,
    weight_lbs: slot.target_weight_lbs ?? lastElsewhere?.weight_lbs ?? null,
  }
}

/**
 * Total sets logged into a workout, prescribed and extra alike — the headline
 * count while a session is running.
 *
 * @param workoutSets Every set belonging to the open workout.
 */
export function totalSetsLogged(workoutSets: readonly StrengthSet[]): number {
  return workoutSets.length
}

/**
 * The next `position` to stamp on a set, so the order it was performed in
 * survives even when two movements are interleaved.
 *
 * Takes the max rather than the count: sets get deleted, and reusing a freed
 * index would put a new set in the middle of the history.
 *
 * @param workoutSets Every set belonging to the open workout.
 */
export function nextSetPosition(workoutSets: readonly StrengthSet[]): number {
  let max = -1
  for (const set of workoutSets) {
    if (set.position !== undefined && set.position > max) max = set.position
  }
  return max + 1
}
