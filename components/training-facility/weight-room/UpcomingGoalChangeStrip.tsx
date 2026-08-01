import type { JSX } from 'react'

import { exerciseLabel } from '@/lib/training-facility/exercise-labels'
import {
  formatGoalTargetChange,
  formatGoalTargetDate,
  scheduledGoalTargetChanges,
} from '@/lib/training-facility/goal-targets'
import type { ExerciseGoal } from '@/types/weight-room'

/** Props for {@link UpcomingGoalChangeStrip}. */
export interface UpcomingGoalChangeStripProps {
  /**
   * The goals whose rings are on screen. Each is scanned for target changes
   * queued after {@link todayKey}; goals with none contribute nothing.
   */
  goals: readonly ExerciseGoal[]
  /**
   * Today's `YYYY-MM-DD` key, in the same convention the caller buckets the
   * day with. Passed in rather than computed so the strip agrees with the
   * rings it sits under.
   */
  todayKey: string
}

/**
 * "Target moves" strip for the Weight Room Log View (#371).
 *
 * A daily goal can now be scheduled to change on a future date, and a ring
 * that silently jumps from 30 to 50 one morning is startling. This advertises
 * the change beforehand, deliberately mirroring how {@link
 * import('./UpcomingFocusStrip').UpcomingFocusStrip} announces queued focus
 * rotations — permanent goals becoming schedulable is the same model, so the
 * language should match.
 *
 * Renders `null` when nothing is queued, so callers can drop it in
 * unconditionally.
 */
export function UpcomingGoalChangeStrip({
  goals,
  todayKey,
}: UpcomingGoalChangeStripProps): JSX.Element | null {
  const entries = goals.flatMap((goal) =>
    scheduledGoalTargetChanges(goal, todayKey).map((change) => ({ goal, change })),
  )
  if (entries.length === 0) return null

  // Soonest first, so "what changes next" reads off the front.
  entries.sort((a, b) => a.change.effective_from.localeCompare(b.change.effective_from))

  return (
    <div
      data-testid="upcoming-goal-change-strip"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
        Target moves
      </span>
      {entries.map(({ goal, change }) => (
        <span
          key={`${goal.exercise}-${change.effective_from}`}
          data-testid={`upcoming-goal-change-${goal.exercise}`}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: goal.color }}
          />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
            {exerciseLabel(goal)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/70">
            {formatGoalTargetChange(change)}
          </span>
          <span
            data-testid={`upcoming-goal-change-${goal.exercise}-date`}
            className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/45"
          >
            {formatGoalTargetDate(change)}
          </span>
        </span>
      ))}
    </div>
  )
}
