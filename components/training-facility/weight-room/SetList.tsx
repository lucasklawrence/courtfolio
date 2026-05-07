'use client'

import { useState, type JSX } from 'react'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/** Props for {@link SetList}. */
export interface SetListProps {
  /**
   * Today's sets, sorted oldest → newest. The list reverses internally
   * so the most recent set appears at the top — that's the entry the
   * user usually wants to undo.
   */
  setsToday: readonly StrengthSet[]
  /**
   * Goals indexed by exercise name. Used to look up display color +
   * daily target for the running total readout. Missing entries fall
   * back gracefully to amber + zero target so a deleted goal's leftover
   * sets still render (rare — the FK has ON DELETE CASCADE so the rows
   * usually disappear together).
   */
  goalsByExercise: Readonly<Record<string, ExerciseGoal | undefined>>
  /**
   * Per-row delete handler. Omit to render the list read-only — non-
   * admin viewers don't see the trash icon. Resolves clear the
   * pending-row state; rejects surface as an inline error message.
   */
  onDelete?: (set: StrengthSet) => Promise<void>
  /**
   * `false` while a parent action is in flight. Disables every delete
   * button so a row can't be dropped twice.
   */
  busy?: boolean
}

/**
 * Today's logged sets as a timestamped list, with per-row delete for
 * admin viewers (#80). Mirrors the cardio session log's row layout:
 * mono timestamps, exercise lane color, rep count tabularly aligned.
 *
 * Running per-exercise total renders inline at the top of each
 * exercise's group so the user can see "you're at 75 / 100 pushups
 * after these three sets" without scrolling back to the rings. The
 * group header is sticky-ish — a single header row, not per-set —
 * because the issue's spec is timestamped *list*, not per-exercise
 * tabs.
 */
export function SetList({
  setsToday,
  goalsByExercise,
  onDelete,
  busy = false,
}: SetListProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleDelete(set: StrengthSet): Promise<void> {
    if (!onDelete) return
    setError(null)
    setPendingId(set.id)
    try {
      await onDelete(set)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t delete that set.')
    } finally {
      setPendingId(null)
    }
  }

  if (setsToday.length === 0) {
    return (
      <section aria-label="Today’s sets" className="space-y-2" data-testid="set-list-empty">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Today
        </h2>
        <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-[13px] text-white/55">
          No sets logged yet today.
        </p>
      </section>
    )
  }

  // Most-recent-first for the visible list. Don't mutate the prop.
  const ordered = [...setsToday].reverse()

  return (
    <section aria-label="Today’s sets" className="space-y-2" data-testid="set-list">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
        Today
      </h2>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {ordered.map((s) => {
          const goal = goalsByExercise[s.exercise]
          const color = goal?.color ?? '#fbbf24'
          const isPending = pendingId === s.id
          return (
            <li
              key={s.id}
              data-testid={`set-row-${s.id}`}
              className="flex items-center gap-3 px-4 py-3"
              style={{ opacity: isPending ? 0.5 : 1 }}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span
                className="min-w-[80px] font-mono text-sm font-semibold uppercase tracking-[0.18em]"
                style={{ color }}
              >
                {s.exercise}
              </span>
              <span className="font-mono text-base font-semibold tabular-nums text-white">
                {s.reps}
              </span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-white/55">
                {formatTimeOfDay(s.logged_at)}
              </span>
              {onDelete ? (
                <button
                  type="button"
                  aria-label={`Delete set of ${s.reps} ${s.exercise}`}
                  disabled={busy || isPending}
                  onClick={() => void handleDelete(s)}
                  className="rounded-full border border-rose-300/25 bg-rose-300/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Format an ISO timestamp's time-of-day in the caller's local timezone
 * (`HH:MM`, 12-hour with am/pm). Returns `'—'` for unparseable input
 * so the row stays renderable without throwing.
 */
function formatTimeOfDay(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${minutes}${ampm}`
}
