'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent, type JSX } from 'react'

import type { ExerciseGoal } from '@/types/weight-room'
import { pacificDayKey } from '@/lib/training-facility/day-keys'
import { exerciseLabel } from '@/lib/training-facility/exercise-labels'
import {
  formatGoalTargetChange,
  formatGoalTargetDate,
  scheduledGoalTargetChanges,
} from '@/lib/training-facility/goal-targets'

/** Props for {@link StrengthSettings}. */
export interface StrengthSettingsProps {
  /**
   * Goals as read by the server component on first paint. The form
   * hydrates from this list; mutations refresh via `router.refresh()`
   * so the next render comes from a fresh server fetch (no client
   * cache to invalidate).
   */
  initialGoals: readonly ExerciseGoal[]
}

const DEFAULT_NEW_COLOR = '#EA580C'

/**
 * Admin-only Weight Room goal editor (#79). Renders the existing
 * goals as an editable list (target + color) and offers a small form
 * to add new exercises. Each mutation hits the matching admin API
 * route under `/api/admin/weight-room/goals`; on success the parent
 * page's server data refreshes via `router.refresh()` so the next
 * render reflects the new state without a manual reload.
 *
 * Mobile-first per the issue body — the layout stacks single-column
 * with large touch targets so the editor works on the same phone the
 * user logs sets from.
 */
export function StrengthSettings({ initialGoals }: StrengthSettingsProps): JSX.Element {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function refresh(): void {
    startTransition(() => {
      router.refresh()
    })
  }

  /** @returns whether the write actually landed, so the row can keep the
   *  admin's input on failure instead of clearing it. */
  async function postGoal(goal: ExerciseGoal): Promise<boolean> {
    setError(null)
    const res = await fetch('/api/admin/weight-room/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? `Save failed (${res.status})`)
      return false
    }
    refresh()
    return true
  }

  async function deleteGoal(exercise: string, label: string = exercise): Promise<void> {
    setError(null)
    // Sets FK into the movement catalog, not into goals (#373), so this drops
    // the daily ring and its target history and leaves the training log alone.
    const ok = window.confirm(
      `Remove the daily goal for "${label}"? Its logged sets are kept — this only stops the daily ring and clears its target history.`
    )
    if (!ok) return
    const res = await fetch(`/api/admin/weight-room/goals/${encodeURIComponent(exercise)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? `Delete failed (${res.status})`)
      return
    }
    refresh()
  }

  async function cancelScheduled(exercise: string, effectiveFrom: string): Promise<void> {
    setError(null)
    const res = await fetch(
      `/api/admin/weight-room/goals/${encodeURIComponent(exercise)}/targets/${encodeURIComponent(effectiveFrom)}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? `Cancel failed (${res.status})`)
      return
    }
    refresh()
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <section aria-label="Existing exercises">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Exercises
        </h2>
        {initialGoals.length === 0 ? (
          <p className="mt-3 text-sm text-[#e8d5be]/70">
            No exercises yet — add one below to start logging sets.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {initialGoals.map(goal => (
              <GoalRow
                key={goal.exercise}
                goal={goal}
                disabled={isPending}
                onSave={postGoal}
                onDelete={deleteGoal}
                onCancelScheduled={cancelScheduled}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Add a new exercise">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Add exercise
        </h2>
        <AddGoalForm disabled={isPending} onAdd={postGoal} />
      </section>
    </div>
  )
}

interface GoalRowProps {
  goal: ExerciseGoal
  disabled: boolean
  onSave: (goal: ExerciseGoal) => Promise<boolean>
  onDelete: (exercise: string, label: string) => Promise<void>
  /** Cancel a queued change, addressed by its `effective_from` (#371). */
  onCancelScheduled: (exercise: string, effectiveFrom: string) => Promise<void>
}

function GoalRow({
  goal,
  disabled,
  onSave,
  onDelete,
  onCancelScheduled,
}: GoalRowProps): JSX.Element {
  const [target, setTarget] = useState<number>(goal.daily_target)
  const [color, setColor] = useState<string>(goal.color)
  // Blank means "today", which is what the API assumes when `effective_from`
  // is omitted. A future date queues the change instead of applying it (#371).
  const [effectiveFrom, setEffectiveFrom] = useState<string>('')

  const today = pacificDayKey(new Date())
  const scheduled = scheduledGoalTargetChanges(goal, today)

  // A chosen date is itself a change worth saving. Without this, queuing a
  // *reversion* is impossible: with 50 already scheduled for September, going
  // back to 30 in October means submitting a target equal to today's, which a
  // value-only dirty check treats as a no-op — even though 30 genuinely differs
  // from the 50 in effect on that date, and the API would record it.
  const dirty = target !== goal.daily_target || color !== goal.color || effectiveFrom !== ''

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!dirty) return
    const scheduledForLater = effectiveFrom !== '' && effectiveFrom > today
    const saved = await onSave({
      exercise: goal.exercise,
      daily_target: target,
      color,
      ...(effectiveFrom === '' ? {} : { effective_from: effectiveFrom }),
    })
    // `postGoal` reports failure rather than throwing, so without this the row
    // would clear the date and snap the target back as though the write landed
    // — discarding the admin's input and hiding that nothing was recorded.
    if (!saved) return
    setEffectiveFrom('')
    // Scheduling deliberately leaves today's target alone, so the refreshed
    // goal comes back unchanged and this input would keep showing the *future*
    // number with Save still enabled. A later save — or an unrelated colour
    // tweak — would then post it with no date and apply it immediately,
    // silently defeating the schedule. Snap back to what's actually in effect.
    if (scheduledForLater) setTarget(goal.daily_target)
  }

  return (
    <li className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {exerciseLabel(goal)}
        </span>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">target</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={e => setTarget(Number(e.target.value))}
            className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">color</span>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-black/40"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">from</span>
          <input
            type="date"
            value={effectiveFrom}
            onChange={e => setEffectiveFrom(e.target.value)}
            aria-label={`Effective date for the ${exerciseLabel(goal)} target`}
            title="Leave blank to apply today. A past date backdates the change; a future date schedules it."
            className="rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="submit"
            disabled={disabled || !dirty}
            className="rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(goal.exercise, exerciseLabel(goal))}
            className="rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </form>

      {scheduled.length > 0 ? (
        <ul
          data-testid={`goal-scheduled-${goal.exercise}`}
          className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3"
        >
          {scheduled.map(change => (
            <li
              key={change.effective_from}
              className="flex flex-wrap items-center gap-3 text-xs text-white/70"
            >
              <span className="font-mono uppercase tracking-[0.18em] text-amber-200/80">
                scheduled
              </span>
              <span className="font-mono tabular-nums text-white">
                {formatGoalTargetChange(change)}
              </span>
              <span className="font-mono text-white/55">on {formatGoalTargetDate(change)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onCancelScheduled(goal.exercise, change.effective_from)}
                aria-label={`Cancel the scheduled ${exerciseLabel(goal)} change to ${change.to} on ${formatGoalTargetDate(change)}`}
                className="ml-auto rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

interface AddGoalFormProps {
  disabled: boolean
  onAdd: (goal: ExerciseGoal) => Promise<boolean>
}

function AddGoalForm({ disabled, onAdd }: AddGoalFormProps): JSX.Element {
  const [exercise, setExercise] = useState<string>('')
  const [target, setTarget] = useState<number>(50)
  const [color, setColor] = useState<string>(DEFAULT_NEW_COLOR)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmed = exercise.trim().toLowerCase()
    if (trimmed.length === 0) return
    await onAdd({ exercise: trimmed, daily_target: target, color })
    setExercise('')
    setTarget(50)
    setColor(DEFAULT_NEW_COLOR)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid gap-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
    >
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">exercise</span>
        <input
          type="text"
          required
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          placeholder="dips"
          autoCapitalize="none"
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">target</span>
        <input
          type="number"
          min={1}
          value={target}
          onChange={e => setTarget(Number(e.target.value))}
          className="w-24 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">color</span>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-black/40"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || exercise.trim().length === 0}
        className="rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
