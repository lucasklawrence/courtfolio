'use client'

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { useRouter } from 'next/navigation'

import { buildExerciseLabels, slugLabel } from '@/lib/training-facility/exercise-labels'
import {
  buildSlotProgress,
  extraSets,
  nextSetDefaults,
  nextSetPosition,
  stepExercise,
  type SlotProgress,
} from '@/lib/training-facility/live-workout'
import { formatSlotPrescription } from '@/lib/training-facility/template-format'
import { workoutDurationMinutes } from '@/lib/training-facility/workout-sessions'
import type {
  StrengthSet,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutTemplate,
} from '@/types/weight-room'

/** Props for {@link LiveWorkoutPanel}. */
export interface LiveWorkoutPanelProps {
  /**
   * Every logged set, from the parent island's single read. The panel filters
   * to the open workout rather than fetching its own copy, so the set list
   * below it and the panel can never disagree about what was just logged.
   */
  sets: readonly StrengthSet[]
  /** The movement catalog, for swaps and added movements. Archived filtered out by the caller. */
  exercises: readonly WeightRoomExercise[]
  /** Templates available to start from. Archived filtered out by the caller. */
  templates: readonly WorkoutTemplate[]
  /** Whether a write is in flight elsewhere on the page. */
  disabled: boolean
  /** Called after any successful write so the parent refetches. */
  onChanged: () => void | Promise<void>
}

/**
 * The live workout surface (#376) — start from a template, then log, swap, add,
 * and end.
 *
 * Sits **above** the grease-the-groove dashboard rather than replacing it, so a
 * desk pushup set mid-session is still one tap. That matters more than it
 * sounds: pull-ups and push-ups appear in the templates *and* in the daily
 * rings, and forcing a choice between them would make one of the two wrong.
 *
 * Every set POSTs immediately — the server is the source of truth and a reload
 * resumes the open session with everything intact. A failed write surfaces on
 * the set it belongs to and is retryable, rather than being swallowed or
 * escalated to a page-level error. There is deliberately no offline queue.
 */
export function LiveWorkoutPanel({
  sets,
  exercises,
  templates,
  disabled,
  onChanged,
}: LiveWorkoutPanelProps): JSX.Element {
  const router = useRouter()
  const [workout, setWorkout] = useState<WeightRoomWorkout | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [templateId, setTemplateId] = useState<string>('')

  // Built from the roster rather than from goals: a gym movement has no daily
  // goal at all, so a goal-derived lookup would render every one of them as a
  // raw slug.
  const labels = useMemo(() => buildExerciseLabels(exercises), [exercises])

  /**
   * Ask the server whether a session is already open. Returns the value rather
   * than setting state, so the mount effect can drop a late response after
   * unmount instead of writing to a gone component.
   */
  const fetchOpen = useCallback(async (): Promise<WeightRoomWorkout | null> => {
    try {
      const res = await fetch('/api/admin/weight-room/workouts?open=true')
      if (!res.ok) return null
      return (await res.json()) as WeightRoomWorkout | null
    } catch {
      // A failed probe isn't the same as "no session", but there's nothing
      // useful to render either way and the retry is a page reload.
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchOpen().then(open => {
      if (!cancelled) setWorkout(open)
    })
    return () => {
      cancelled = true
    }
  }, [fetchOpen])

  /** Sets belonging to the open session, oldest first. */
  const workoutSets = useMemo(() => {
    if (!workout) return []
    return sets
      .filter(set => set.workout_id === workout.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }, [sets, workout])

  /**
   * The template this session is running.
   *
   * By id. Matching on `title` resolves to the wrong template whenever two
   * share a name — nothing constrains them to be unique — and loses the
   * prescription entirely if one is renamed mid-session. The title fallback
   * exists only for sessions started before `template_id` existed.
   */
  const template = useMemo(() => {
    if (!workout) return null
    if (workout.template_id !== undefined) {
      return templates.find(t => t.id === workout.template_id) ?? null
    }
    if (!workout.title) return null
    return templates.find(t => t.name === workout.title) ?? null
  }, [templates, workout])

  const progress = useMemo(() => buildSlotProgress(template, workoutSets), [template, workoutSets])

  /**
   * The most recent set of each movement across all history, for the first-set
   * prefill. Most seeded slots prescribe sets but not reps, so without this the
   * documented history fallback in `nextSetDefaults` is unreachable and every
   * such slot opens with blank inputs.
   */
  const lastByExercise = useMemo(() => {
    const map = new Map<string, StrengthSet>()
    for (const set of sets) {
      const seen = map.get(set.exercise)
      if (seen === undefined || set.logged_at > seen.logged_at) map.set(set.exercise, set)
    }
    return map
  }, [sets])
  const extras = useMemo(() => extraSets(workoutSets), [workoutSets])

  /**
   * Issue a write and hold the controls disabled until any follow-up settles.
   *
   * `after` runs *inside* the busy window on purpose. Clearing `busy` when the
   * response lands but before the parent refetch completes re-enables the
   * buttons while `workoutSets` still holds the pre-write list — a second tap
   * in that gap computes the same `nextSetPosition`, and two sets end up
   * sharing an index with an ambiguous performed order.
   */
  async function post(
    url: string,
    init: RequestInit,
    fallback: string,
    after?: () => void | Promise<void>
  ): Promise<boolean> {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `${fallback} (${res.status})`)
        return false
      }
      await after?.()
      return true
    } catch {
      setError(`${fallback} — the request didn't reach the server. Try again.`)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function startWorkout(): Promise<void> {
    const chosen = templates.find(t => t.id === templateId)
    const ok = await post(
      '/api/admin/weight-room/workouts',
      {
        method: 'POST',
        body: JSON.stringify({
          location: 'gym',
          ...(chosen ? { template_id: chosen.id, title: chosen.name } : {}),
        }),
      },
      'Could not start the workout',
      async () => {
        setWorkout(await fetchOpen())
        await onChanged()
      }
    )
    if (!ok) return
  }

  async function endWorkout(): Promise<void> {
    if (!workout) return
    // Captured before the state clears — the summary route needs the id, and
    // `workout` is null by the time the navigation runs.
    const endedId = workout.id
    const ok = await post(
      `/api/admin/weight-room/workouts/${workout.id}`,
      { method: 'PATCH', body: JSON.stringify({ ended_at: new Date().toISOString() }) },
      'Could not end the workout',
      async () => {
        setWorkout(null)
        await onChanged()
      }
    )
    if (!ok) return
    // Ending a session lands on its summary (#377). Navigating only after a
    // confirmed write means a failed end leaves you on the panel with the
    // session still open and the error visible, rather than on a summary page
    // for a workout that is still running.
    router.push(`/training-facility/weight-room/workouts/${endedId}`)
  }

  async function logSet(
    exercise: string,
    reps: number,
    weightLbs: number | null,
    slotId: string | null,
    stepId: string | null = null
  ): Promise<boolean> {
    if (!workout) return false
    return post(
      '/api/admin/weight-room/sets',
      {
        method: 'POST',
        body: JSON.stringify({
          exercise,
          reps,
          workout_id: workout.id,
          position: nextSetPosition(workoutSets),
          ...(weightLbs != null ? { weight_lbs: weightLbs } : {}),
          ...(slotId != null ? { template_slot_id: slotId } : {}),
          // Only ever alongside a slot — the schema rejects a step without one,
          // since a step belongs to a slot (#407).
          ...(slotId != null && stepId != null ? { template_slot_step_id: stepId } : {}),
        }),
      },
      'Could not log the set',
      onChanged
    )
  }

  async function deleteSet(id: string): Promise<void> {
    const ok = await post(
      `/api/admin/weight-room/sets/${id}`,
      { method: 'DELETE' },
      'Could not remove the set',
      onChanged
    )
    if (!ok) return
  }

  if (workout === undefined) {
    return (
      <div className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
        Checking for an open workout…
      </div>
    )
  }

  if (workout === null) {
    return (
      <section
        aria-label="Start a workout"
        className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4"
      >
        {error ? <ErrorLine message={error} /> : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-white/70">
            <span className="font-mono uppercase tracking-[0.18em]">start a workout</span>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="rounded border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
            >
              <option value="" className="bg-[#120d0a]">
                — no template, freestyle —
              </option>
              {templates.map(t => (
                <option key={t.id} value={t.id} className="bg-[#120d0a]">
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void startWorkout()}
            className="rounded-full border border-amber-200/40 bg-amber-200/15 px-6 py-2.5 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start
          </button>
        </div>
      </section>
    )
  }

  const minutes = workoutDurationMinutes({
    started_at: workout.started_at,
    ended_at: new Date().toISOString(),
  })

  return (
    <section
      aria-label="Live workout"
      className="rounded-[1.1rem] border border-amber-300/30 bg-amber-300/5 p-4"
    >
      {error ? <ErrorLine message={error} /> : null}

      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-amber-300/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100">
          live
        </span>
        <span className="text-sm font-semibold text-white">
          {workout.title ?? 'Freestyle workout'}
        </span>
        <span className="font-mono text-[11px] text-white/50">
          {minutes ?? 0} min · {workoutSets.length} {workoutSets.length === 1 ? 'set' : 'sets'}
        </span>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void endWorkout()}
          className="ml-auto rounded-full border border-white/25 bg-white/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          End
        </button>
      </header>

      {progress.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {progress.map(entry => (
            <SlotCard
              key={entry.slot.id}
              entry={entry}
              exercises={exercises}
              labels={labels}
              lastElsewhere={lastByExercise.get(entry.performedExercise) ?? null}
              disabled={disabled || busy}
              onLog={logSet}
              onDeleteSet={deleteSet}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-white/50">
          No template — log whatever you do below and it all counts as this workout.
        </p>
      )}

      {extras.length > 0 ? (
        <div className="mt-4">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Extra work
          </h4>
          <ul className="mt-1 space-y-1">
            {extras.map(set => (
              <li
                key={set.id}
                className="flex items-center gap-2 font-mono text-[11px] text-white/60"
              >
                <span>{slugLabel(set.exercise, undefined, labels)}</span>
                <span className="text-white/40">
                  {set.reps}
                  {set.weight_lbs != null ? ` × ${set.weight_lbs} lb` : ''}
                </span>
                <button
                  type="button"
                  aria-label="Remove set"
                  disabled={disabled || busy}
                  onClick={() => void deleteSet(set.id)}
                  className="ml-auto px-1 text-white/40 transition hover:text-rose-300 disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AddMovement
        exercises={exercises}
        disabled={disabled || busy}
        onLog={(exercise, reps, weight) => logSet(exercise, reps, weight, null)}
      />
    </section>
  )
}

/** Inline, retryable failure line. Never escalates to a page-level error. */
function ErrorLine({ message }: { message: string }): JSX.Element {
  return (
    <p
      role="alert"
      className="mb-3 rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[11px] text-rose-200"
    >
      {message}
    </p>
  )
}

interface SlotCardProps {
  entry: SlotProgress
  exercises: readonly WeightRoomExercise[]
  /** Slug → display-name lookup, built from the roster by the parent. */
  labels: ReturnType<typeof buildExerciseLabels>
  /**
   * The most recent set of this movement from any earlier session, for the
   * first-set prefill when the slot prescribes no reps.
   */
  lastElsewhere: StrengthSet | null
  disabled: boolean
  onLog: (
    exercise: string,
    reps: number,
    weightLbs: number | null,
    slotId: string | null,
    stepId?: string | null
  ) => Promise<boolean>
  onDeleteSet: (id: string) => Promise<void>
}

function SlotCard({
  entry,
  exercises,
  labels,
  lastElsewhere,
  disabled,
  onLog,
  onDeleteSet,
}: SlotCardProps): JSX.Element {
  const { slot, sets, performedExercise, isSubstituted, isComplete, isStepped, steps, nextStep } =
    entry
  // For a stepped slot the counter must show passes, not rungs: two drop sets
  // are eight rows (#407).
  const shown = entry.completedSets
  // A superset's step names its own movement; a drop set's inherits the slot's.
  const stepMovement = stepExercise(slot, nextStep)
  const stepIndex = nextStep === null ? -1 : steps.findIndex(st => st.id === nextStep.id)
  const defaults = nextSetDefaults(slot, sets, lastElsewhere, nextStep)
  const [reps, setReps] = useState<string>(defaults.reps?.toString() ?? '')
  const [weight, setWeight] = useState<string>(defaults.weight_lbs?.toString() ?? '')
  const [swapOpen, setSwapOpen] = useState(false)
  const [exercise, setExercise] = useState(isStepped ? stepMovement : performedExercise)

  // The alternates first, then everything else — the whole point of declaring
  // them is that the common swap is one tap rather than a search.
  const swapOptions = useMemo(() => {
    const preferred = slot.alternates.map(a => a.exercise)
    const rest = exercises
      .map(e => e.slug)
      .filter(slug => slug !== slot.exercise && !preferred.includes(slug))
    return [slot.exercise, ...preferred, ...rest]
  }, [exercises, slot])

  async function handleLog(): Promise<void> {
    const repsValue = Number(reps)
    if (!Number.isFinite(repsValue) || repsValue < 1) return
    const weightValue = weight.trim() === '' ? null : Number(weight)
    await onLog(
      isStepped ? stepMovement : exercise,
      repsValue,
      weightValue != null && Number.isFinite(weightValue) ? weightValue : null,
      slot.id,
      nextStep?.id ?? null
    )
  }

  return (
    <li
      className={`rounded-[0.9rem] border p-3 ${
        isComplete ? 'border-emerald-300/25 bg-emerald-300/5' : 'border-white/10 bg-black/25'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm text-white">
          {slugLabel(performedExercise, undefined, labels)}
        </span>
        {isSubstituted ? (
          <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100">
            swapped from {slugLabel(slot.exercise, undefined, labels)}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-white/50">
          {shown} / {slot.target_sets}
          {slot.target_sets_max != null && slot.target_sets_max !== slot.target_sets
            ? `-${slot.target_sets_max}`
            : ''}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-[11px] text-white/35">
        {formatSlotPrescription(slot)}
        {slot.notes ? ` · ${slot.notes}` : ''}
      </p>

      {isStepped && nextStep !== null ? (
        <p
          data-testid={`slot-step-${slot.id}`}
          className="mt-2 rounded border border-sky-300/25 bg-sky-300/5 px-2 py-1 font-mono text-[11px] text-sky-100"
        >
          Step {stepIndex + 1} of {steps.length}
          {nextStep.exercise != null ? ` · ${slugLabel(nextStep.exercise, undefined, labels)}` : ''}
          {nextStep.target_weight_lbs != null ? ` · ${nextStep.target_weight_lbs} lb` : ''}
          {nextStep.target_reps != null ? ` × ${nextStep.target_reps}` : ''}
          {nextStep.notes ? ` · ${nextStep.notes}` : ''}
        </p>
      ) : null}

      {sets.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {sets.map((set, index) => (
            <li key={set.id}>
              <button
                type="button"
                aria-label={`Remove set ${index + 1}`}
                disabled={disabled}
                onClick={() => void onDeleteSet(set.id)}
                title="Tap to remove"
                className="rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/70 transition hover:border-rose-300/40 hover:text-rose-200 disabled:opacity-30"
              >
                {set.reps}
                {set.weight_lbs != null ? `×${set.weight_lbs}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] text-white/50">
          <span className="font-mono uppercase tracking-[0.14em]">reps</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={reps}
            onChange={e => setReps(e.target.value)}
            className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-white/50">
          <span className="font-mono uppercase tracking-[0.14em]">lb</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="bw"
            className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={disabled || reps.trim() === ''}
          onClick={() => void handleLog()}
          className="rounded-full border border-amber-200/40 bg-amber-200/15 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-200/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Log set
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSwapOpen(!swapOpen)}
          className="ml-auto rounded-full border border-white/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60 transition hover:bg-white/10 disabled:opacity-40"
        >
          Swap
        </button>
      </div>

      {swapOpen ? (
        <label className="mt-2 flex flex-col gap-1 text-[10px] text-white/50">
          <span className="font-mono uppercase tracking-[0.14em]">perform this slot with</span>
          <select
            value={exercise}
            onChange={e => {
              setExercise(e.target.value)
              setSwapOpen(false)
            }}
            className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none"
          >
            {swapOptions.map(slug => (
              <option key={slug} value={slug} className="bg-[#120d0a]">
                {slugLabel(slug, undefined, labels)}
                {slug === slot.exercise ? ' (prescribed)' : ''}
                {slot.alternates.some(a => a.exercise === slug) ? ' — alternate' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </li>
  )
}

interface AddMovementProps {
  exercises: readonly WeightRoomExercise[]
  disabled: boolean
  /** Resolves `true` only when the write was confirmed by the server. */
  onLog: (exercise: string, reps: number, weightLbs: number | null) => Promise<boolean>
}

function AddMovement({ exercises, disabled, onLog }: AddMovementProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [exercise, setExercise] = useState(exercises[0]?.slug ?? '')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-white/20 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 disabled:opacity-40"
      >
        + add movement
      </button>
    )
  }

  return (
    <div className="mt-4 grid gap-2 rounded border border-white/10 bg-black/25 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <label className="flex flex-col gap-0.5 text-[10px] text-white/50">
        <span className="font-mono uppercase tracking-[0.14em]">movement</span>
        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none"
        >
          {exercises.map(e => (
            <option key={e.slug} value={e.slug} className="bg-[#120d0a]">
              {e.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] text-white/50">
        <span className="font-mono uppercase tracking-[0.14em]">reps</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={reps}
          onChange={e => setReps(e.target.value)}
          className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] text-white/50">
        <span className="font-mono uppercase tracking-[0.14em]">lb</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="bw"
          className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <button
        type="button"
        disabled={disabled || reps.trim() === '' || exercise === ''}
        onClick={() => {
          const repsValue = Number(reps)
          if (!Number.isFinite(repsValue) || repsValue < 1) return
          const weightValue = weight.trim() === '' ? null : Number(weight)
          // Only clear on a confirmed write. Clearing regardless makes the
          // advertised retryable failure useless — you'd have to remember the
          // reps you just typed and enter them again.
          void onLog(
            exercise,
            repsValue,
            weightValue != null && Number.isFinite(weightValue) ? weightValue : null
          ).then(logged => {
            if (logged) setReps('')
          })
        }}
        className="self-end rounded-full border border-amber-200/40 bg-amber-200/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-200/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Log
      </button>
    </div>
  )
}
