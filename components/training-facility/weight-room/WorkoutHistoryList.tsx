import type { JSX } from 'react'
import Link from 'next/link'

import type { WorkoutHistoryEntry } from '@/lib/training-facility/workout-stats'

/** Route the workout history lives at; also the base for every filter chip. */
export const WORKOUTS_ROUTE = '/training-facility/weight-room/workouts'

/** One entry in the filter rail. */
export interface TemplateFilterOption {
  /** Template id, or `null` for the "all workouts" chip. */
  id: string | null
  /** Chip label. */
  name: string
  /** Hex chip color, when the template has one. */
  color: string | null
  /** How many recorded sessions ran it. */
  count: number
}

/** Props for {@link WorkoutHistoryList}. */
export interface WorkoutHistoryListProps {
  /** Sessions to render, newest first and already filtered. */
  entries: readonly WorkoutHistoryEntry[]
  /** Filter chips, "All" first. Empty when no template has ever been run. */
  filters: readonly TemplateFilterOption[]
  /** Currently selected template id, or `null` for all. */
  selectedTemplateId: string | null
  /** Whether any session exists at all, so a filtered-to-nothing view reads differently from a fresh log. */
  hasAnyWorkouts: boolean
  /**
   * Whether these rows came from the demo fixture. Carries `?preview=demo`
   * through to each summary link — without it a demo row would click through to
   * a 404, since the id it names exists in no database.
   */
  isPreviewMode?: boolean
}

/**
 * Reverse-chronological workout history (#377) — the public read-only index of
 * every recorded session, and the way into each one's summary.
 *
 * Filtering is a **URL param** (`?template=<id>`) rather than component state,
 * matching the History view's exercise filter (#367): the page stays a Server
 * Component, and "my last four leg days" is a link someone can keep.
 */
export function WorkoutHistoryList({
  entries,
  filters,
  selectedTemplateId,
  hasAnyWorkouts,
  isPreviewMode = false,
}: WorkoutHistoryListProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {filters.length > 1 ? (
        <TemplateFilterRail filters={filters} selectedTemplateId={selectedTemplateId} />
      ) : null}

      {entries.length === 0 ? (
        <p
          data-testid="workout-history-empty"
          className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
        >
          {hasAnyWorkouts
            ? 'No sessions recorded for that template yet.'
            : 'No workouts recorded yet. Start one from the Log page and it will show up here.'}
        </p>
      ) : (
        <ul data-testid="workout-history" className="flex flex-col gap-3">
          {entries.map(entry => (
            <li key={entry.workout.id}>
              <WorkoutHistoryRow entry={entry} isPreviewMode={isPreviewMode} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface TemplateFilterRailProps {
  filters: readonly TemplateFilterOption[]
  selectedTemplateId: string | null
}

function TemplateFilterRail({ filters, selectedTemplateId }: TemplateFilterRailProps): JSX.Element {
  return (
    <nav aria-label="Filter by template" data-testid="workout-template-filter">
      <ul className="flex flex-wrap gap-2">
        {filters.map(option => {
          const isActive = option.id === selectedTemplateId
          return (
            <li key={option.id ?? 'all'}>
              <Link
                href={
                  option.id === null ? WORKOUTS_ROUTE : `${WORKOUTS_ROUTE}?template=${option.id}`
                }
                aria-current={isActive ? 'page' : undefined}
                data-testid={`workout-filter-${option.id ?? 'all'}`}
                className={
                  isActive
                    ? 'inline-flex items-center gap-1.5 rounded-full bg-[#f5f1e6] px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#0a0a0a]'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#e8d5be]/75 transition hover:border-white/35 hover:text-[#f7ead9]'
                }
              >
                {option.color !== null ? (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                ) : null}
                {option.name}
                <span className={isActive ? 'text-[#0a0a0a]/50' : 'text-[#e8d5be]/45'}>
                  {option.count}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

interface WorkoutHistoryRowProps {
  entry: WorkoutHistoryEntry
  isPreviewMode: boolean
}

/** Format a session's start as `Fri, Aug 1` — the year only when it isn't this one. */
function formatStart(startedAt: string): string {
  const date = new Date(startedAt)
  if (!Number.isFinite(date.getTime())) return 'Unknown date'
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function WorkoutHistoryRow({ entry, isPreviewMode }: WorkoutHistoryRowProps): JSX.Element {
  const { summary, workout } = entry
  const heading = entry.templateName ?? workout.title ?? 'Freestyle session'
  const topLift = summary.exercises.find(e => e.topSet !== null)

  return (
    <Link
      href={`${WORKOUTS_ROUTE}/${workout.id}${isPreviewMode ? '?preview=demo' : ''}`}
      data-testid={`workout-row-${workout.id}`}
      className="block rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-4 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)] transition hover:border-white/40 hover:shadow-[0_16px_40px_rgba(0,0,0,0.36)] sm:p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em]">
          {entry.templateColor !== null ? (
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.templateColor }}
            />
          ) : null}
          {heading}
        </h3>
        <p className="text-xs text-[#0a0a0a]/60">{formatStart(workout.started_at)}</p>
      </header>

      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tabular-nums">
        <span>
          <span className="font-bold">{summary.totalSets}</span>
          <span className="text-[#0a0a0a]/55"> sets</span>
        </span>
        <span>
          <span className="font-bold">{summary.totalReps.toLocaleString('en-US')}</span>
          <span className="text-[#0a0a0a]/55"> reps</span>
        </span>
        {summary.tonnage > 0 ? (
          <span>
            <span className="font-bold">{Math.round(summary.tonnage).toLocaleString('en-US')}</span>
            <span className="text-[#0a0a0a]/55"> lb</span>
          </span>
        ) : null}
        {summary.durationMinutes !== null ? (
          <span>
            <span className="font-bold">{summary.durationMinutes}</span>
            <span className="text-[#0a0a0a]/55"> min</span>
          </span>
        ) : summary.isInProgress ? (
          <span className="rounded bg-[#b45309]/15 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[#b45309]">
            {summary.isAbandoned ? 'never ended' : 'in progress'}
          </span>
        ) : null}
      </p>

      {topLift?.topSet != null ? (
        <p className="mt-1.5 text-xs text-[#0a0a0a]/60">
          Top set · {topLift.displayName ?? topLift.exercise} {topLift.topSet.reps} ×{' '}
          {Math.round(topLift.topSet.effectiveLoad).toLocaleString('en-US')} lb
        </p>
      ) : null}
    </Link>
  )
}
