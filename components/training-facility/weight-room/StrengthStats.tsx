import type { JSX } from 'react'

import type { StrengthExerciseStats } from '@/lib/training-facility/weight-room-history'

/** Props for {@link StrengthStats}. */
export interface StrengthStatsProps {
  /**
   * One pre-computed entry per exercise — see
   * {@link import('@/lib/training-facility/weight-room-history').computeStrengthStats}.
   * Empty array renders the empty-state message.
   */
  stats: readonly StrengthExerciseStats[]
}

/**
 * Per-exercise stats panel for the History View (#81): streaks,
 * weekly/monthly rep totals, average sets per active day, and all-time
 * reps. One cream card per exercise on the dark Weight Room surface,
 * matching the cardio overview's `bg-[#f5f1e6]` card aesthetic so the
 * two facilities feel like one app.
 *
 * The "vs last" line on the week / month cells is a literal previous-
 * period count — no percentage delta. Picking a delta direction would
 * require deciding whether bigger-is-better universally for strength
 * (it isn't — a deload week is intentional), so the panel just shows
 * both numbers and lets the reader interpret.
 */
export function StrengthStats({ stats }: StrengthStatsProps): JSX.Element {
  if (stats.length === 0) {
    return (
      <p
        data-testid="strength-stats-empty"
        className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
      >
        No exercises configured yet — add one in Settings to start tracking history.
      </p>
    )
  }

  return (
    <section aria-label="Strength stats" className="grid gap-4 md:grid-cols-2">
      {stats.map((stat) => (
        <ExerciseStatCard key={stat.exercise} stat={stat} />
      ))}
    </section>
  )
}

interface ExerciseStatCardProps {
  stat: StrengthExerciseStats
}

function ExerciseStatCard({ stat }: ExerciseStatCardProps): JSX.Element {
  const isStreaking = stat.currentStreak > 0
  return (
    <article
      data-testid={`strength-stat-card-${stat.exercise}`}
      className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3
          className="font-mono text-sm font-bold uppercase tracking-[0.2em]"
          style={{ color: stat.color }}
        >
          {stat.exercise}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
          goal {stat.dailyTarget}/day
        </span>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <StreakCell
          label="current"
          value={stat.currentStreak}
          highlight={isStreaking}
          suffix={stat.currentStreak === 1 ? 'day' : 'days'}
        />
        <StreakCell
          label="longest"
          value={stat.longestStreak}
          suffix={stat.longestStreak === 1 ? 'day' : 'days'}
        />

        <PeriodCell label="this week" value={stat.thisWeekReps} compare={stat.lastWeekReps} />
        <PeriodCell label="this month" value={stat.thisMonthReps} compare={stat.lastMonthReps} />

        <SimpleCell
          label="avg sets / active day"
          value={formatAvg(stat.avgSetsPerActiveDay)}
        />
        <SimpleCell label="all-time reps" value={stat.allTimeReps.toLocaleString('en-US')} />
      </div>
    </article>
  )
}

interface StreakCellProps {
  label: string
  value: number
  suffix: string
  highlight?: boolean
}

function StreakCell({ label, value, suffix, highlight }: StreakCellProps): JSX.Element {
  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span aria-hidden="true" className={`text-base ${highlight ? '' : 'opacity-30 grayscale'}`}>
          {'\u{1F525}'}
        </span>
        <span className="font-mono text-3xl font-semibold tabular-nums">{value}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/60">
          {suffix}
        </span>
      </p>
      <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/65">
        {label}
      </p>
    </div>
  )
}

interface PeriodCellProps {
  label: string
  value: number
  compare: number
}

function PeriodCell({ label, value, compare }: PeriodCellProps): JSX.Element {
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {value.toLocaleString('en-US')}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/60">
          reps
        </span>
      </p>
      <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/65">
        {label}
        <span className="ml-2 font-normal normal-case tracking-normal text-[#0a0a0a]/55">
          vs {compare.toLocaleString('en-US')} prior
        </span>
      </p>
    </div>
  )
}

interface SimpleCellProps {
  label: string
  value: string
}

function SimpleCell({ label, value }: SimpleCellProps): JSX.Element {
  return (
    <div>
      <p className="font-mono text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/65">
        {label}
      </p>
    </div>
  )
}

/**
 * Format the average-sets-per-day cell. One decimal place is enough
 * resolution to differentiate "logged once today" from "logged twice"
 * without numeric noise; falls back to `—` for the no-data case.
 */
function formatAvg(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n.toFixed(1)
}
