import type {
  StrengthSet,
  TemplateSlot,
  TemplateSlotStep,
  WorkoutTemplate,
} from '@/types/weight-room'

import { compareInstants } from './workout-sessions'

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
  /** Raw rows logged. For a stepped slot this counts *mini-sets*, not sets. */
  logged: number
  /**
   * Sets in the sense the prescription means, and the number compared against
   * `target_sets`.
   *
   * For a straight slot this is just {@link logged}. For a **stepped** slot it
   * is completed passes through the sequence (#407): one trip down a rack run
   * is one set, however many rungs it has. Counting rows there would read
   * `8 / 2` for two drop sets.
   */
  completedSets: number
  /** Whether the slot prescribes a within-set sequence — a drop set or superset. */
  isStepped: boolean
  /** The sequence, ordered. Empty for a straight slot. */
  steps: TemplateSlotStep[]
  /**
   * The step to log next, or `null` for a straight slot.
   *
   * The least-logged step, ties broken by position — which walks the sequence in
   * order on a fresh round, and resumes at the right rung after a reload or a
   * deleted mini-set rather than restarting at the top.
   */
  nextStep: TemplateSlotStep | null
  /**
   * The movement actually being performed. Differs from `slot.exercise` once a
   * set has been logged with something else — the rack was taken.
   *
   * For a stepped slot this stays the slot's own movement: a superset's steps
   * legitimately name different movements, and those are shown per-step rather
   * than collapsed into one label here.
   */
  performedExercise: string
  /**
   * Whether this slot is being performed with a movement other than the one
   * prescribed. Derived from the logged sets, never from a flag: the set rows
   * *are* the record.
   *
   * A stepped slot compares each set to **its own step's** movement, so a
   * superset — where step two is meant to be a different exercise — is not
   * mistaken for a substitution.
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
 * What a given step is meant to be performed with — its own movement for a
 * superset, otherwise the slot's.
 */
export function stepExercise(slot: TemplateSlot, step: TemplateSlotStep | null): string {
  return step?.exercise ?? slot.exercise
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
      // Instants, not strings: the newest set decides `performedExercise`, and
      // this codebase mixes `Z` and Pacific offsets, so a lexicographic sort can
      // hand the wrong set to `.at(-1)` and report the wrong movement as the one
      // currently being performed. See `compareInstants`.
      const sets = (bySlot.get(slot.id) ?? []).sort((a, b) =>
        compareInstants(a.logged_at, b.logged_at)
      )
      const steps = [...slot.steps].sort((a, b) => a.position - b.position)
      const isStepped = steps.length > 0

      if (!isStepped) {
        const performedExercise = sets.at(-1)?.exercise ?? slot.exercise
        return {
          slot,
          sets,
          logged: sets.length,
          completedSets: sets.length,
          isStepped: false,
          steps,
          nextStep: null,
          performedExercise,
          isSubstituted: performedExercise !== slot.exercise,
          isComplete: sets.length >= slot.target_sets,
        }
      }

      // A pass counts as done only when *every* rung has been logged that many
      // times, so 35/35/30/25 is zero complete drop sets rather than one. The
      // minimum across steps is the only measure that says so.
      const countByStep = new Map(steps.map(step => [step.id, 0]))
      let substituted = false
      for (const set of sets) {
        const stepId = set.template_slot_step_id
        if (stepId !== undefined && countByStep.has(stepId)) {
          countByStep.set(stepId, (countByStep.get(stepId) ?? 0) + 1)
        }
        const step = steps.find(s => s.id === stepId) ?? null
        if (set.exercise !== stepExercise(slot, step)) substituted = true
      }
      const completedSets = Math.min(...steps.map(step => countByStep.get(step.id) ?? 0))

      // Least-logged step wins, ties by position — walks the sequence in order,
      // and resumes mid-round after a reload or a deleted mini-set.
      const nextStep = steps.reduce((best, step) =>
        (countByStep.get(step.id) ?? 0) < (countByStep.get(best.id) ?? 0) ? step : best
      )

      return {
        slot,
        sets,
        logged: sets.length,
        completedSets,
        isStepped: true,
        steps,
        nextStep,
        performedExercise: slot.exercise,
        isSubstituted: substituted,
        isComplete: completedSets >= slot.target_sets,
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
 * @param step The step being performed (#407), or `null` for a straight set.
 *   When given, its own prescribed load and reps win over anything else — see
 *   the note in the body about why the usual priority inverts here.
 */
export function nextSetDefaults(
  slot: TemplateSlot,
  setsInSlot: readonly StrengthSet[],
  lastElsewhere: StrengthSet | null = null,
  step: TemplateSlotStep | null = null
): NextSetDefaults {
  // A stepped slot inverts the usual priority (#407). For a straight set the
  // last thing you did is the better guess, because loads get adjusted once and
  // then held. In a rack run the descending loads *are* the prescription —
  // repeating the previous set would hand you 35 lb when the next rung is 30.
  if (step !== null) {
    const sameStep = setsInSlot.filter(set => set.template_slot_step_id === step.id)
    return {
      reps: step.target_reps ?? sameStep.at(-1)?.reps ?? slot.target_reps ?? null,
      weight_lbs: step.target_weight_lbs ?? sameStep.at(-1)?.weight_lbs ?? null,
    }
  }

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
