'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent, type JSX } from 'react'

import type { ExerciseGoal } from '@/types/weight-room'

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

  async function postGoal(goal: ExerciseGoal): Promise<void> {
    setError(null)
    const res = await fetch('/api/admin/weight-room/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? `Save failed (${res.status})`)
      return
    }
    refresh()
  }

  async function deleteGoal(exercise: string): Promise<void> {
    setError(null)
    const ok = window.confirm(
      `Delete "${exercise}"? This also removes every set logged for it.`,
    )
    if (!ok) return
    const res = await fetch(
      `/api/admin/weight-room/goals/${encodeURIComponent(exercise)}`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? `Delete failed (${res.status})`)
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
            {initialGoals.map((goal) => (
              <GoalRow
                key={goal.exercise}
                goal={goal}
                disabled={isPending}
                onSave={postGoal}
                onDelete={deleteGoal}
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
  onSave: (goal: ExerciseGoal) => Promise<void>
  onDelete: (exercise: string) => Promise<void>
}

function GoalRow({ goal, disabled, onSave, onDelete }: GoalRowProps): JSX.Element {
  const [target, setTarget] = useState<number>(goal.daily_target)
  const [color, setColor] = useState<string>(goal.color)
  const dirty = target !== goal.daily_target || color !== goal.color

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!dirty) return
    await onSave({ exercise: goal.exercise, daily_target: target, color })
  }

  return (
    <li className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-center gap-3 sm:gap-4"
      >
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {goal.exercise}
        </span>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">target</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-black/40"
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
            onClick={() => onDelete(goal.exercise)}
            className="rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </form>
    </li>
  )
}

interface AddGoalFormProps {
  disabled: boolean
  onAdd: (goal: ExerciseGoal) => Promise<void>
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
          onChange={(e) => setExercise(e.target.value)}
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
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-24 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
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
