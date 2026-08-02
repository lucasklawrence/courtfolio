import type { JSX } from 'react'
import Link from 'next/link'

import { formatDayKey, safePacificDayKey, todayDayKey } from '@/lib/training-facility/day-keys'
import type { WorkoutHistoryEntry } from '@/lib/training-facility/workout-stats'

/** Route the workout history lives at; also the base for every filter chip. */
export const WORKOUTS_ROUTE = '/training-facility/weight-room/workouts'

/** URL param naming the provenance filter (#413). */
export const SOURCE_FILTER_PARAM = 'source'

/**
 * Provenance filter selection (#413).
 *
 * `'recorded'` — sessions logged set by set through the app. `'imported'` —
 * sessions from an Apple Health export, which know only that lifting happened
 * and for how long. `null` — both, in true chronological order, which is the
 * default because the whole point of importing is to see the two eras together.
 */
export type WorkoutSourceFilter = 'recorded' | 'imported'

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
  /** Currently selected provenance filter, or `null` for both (#413). */
  selectedSource?: WorkoutSourceFilter | null
  /** How many sessions were recorded in-app; drives the Recorded chip's count. */
  recordedCount?: number
  /** How many were imported from Apple Health; drives the Imported chip's count. */
  importedCount?: number
  /** Whether any session exists at all, so a filtered-to-nothing view reads differently from a fresh log. */
  hasAnyWorkouts: boolean
  /**
   * Whether these rows came from the demo fixture. Carries `?preview=demo`
   * through **every** internal link — summary rows and filter chips alike.
   *
   * The fixture only stands in when the real read is empty, so any link that
   * drops the param navigates straight back to the empty state: a demo row would
   * 404 (its id exists in no database) and a filter chip would land on "no
   * workouts recorded yet". The preview has to stay navigable to be worth
   * anything.
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
  selectedSource = null,
  recordedCount = 0,
  importedCount = 0,
}: WorkoutHistoryListProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {importedCount > 0 ? (
        <SourceFilterRail
          selectedSource={selectedSource}
          selectedTemplateId={selectedTemplateId}
          recordedCount={recordedCount}
          importedCount={importedCount}
          isPreviewMode={isPreviewMode}
        />
      ) : null}

      {filters.length > 1 ? (
        <TemplateFilterRail
          filters={filters}
          selectedTemplateId={selectedTemplateId}
          selectedSource={selectedSource}
          isPreviewMode={isPreviewMode}
        />
      ) : null}

      {entries.length === 0 ? (
        <p
          data-testid="workout-history-empty"
          className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
        >
          {hasAnyWorkouts
            ? 'No sessions match that filter yet.'
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
  selectedSource: WorkoutSourceFilter | null
  isPreviewMode: boolean
}

/**
 * Build a chip href carrying every active filter, not just the one being set.
 *
 * The two rails are independent axes, so choosing a template must not silently
 * clear a provenance filter (or vice versa) — and `preview=demo` has to survive
 * both, since the fixture only stands in when the real read is empty and
 * dropping it ends the demo mid-tour.
 */
function chipHref(
  templateId: string | null,
  source: WorkoutSourceFilter | null,
  isPreviewMode: boolean
): string {
  const params = new URLSearchParams()
  if (templateId !== null) params.set('template', templateId)
  if (source !== null) params.set(SOURCE_FILTER_PARAM, source)
  if (isPreviewMode) params.set('preview', 'demo')
  const query = params.toString()
  return query === '' ? WORKOUTS_ROUTE : `${WORKOUTS_ROUTE}?${query}`
}

/** Shared chip styling, so the two rails can't drift apart visually. */
function chipClass(isActive: boolean): string {
  return isActive
    ? 'inline-flex items-center gap-1.5 rounded-full bg-[#f5f1e6] px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#0a0a0a]'
    : 'inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#e8d5be]/75 transition hover:border-white/35 hover:text-[#f7ead9]'
}

interface SourceFilterRailProps {
  selectedSource: WorkoutSourceFilter | null
  selectedTemplateId: string | null
  recordedCount: number
  importedCount: number
  isPreviewMode: boolean
}

/**
 * Provenance rail (#413) — All / Recorded / Imported.
 *
 * Rendered only once imported sessions exist, so a log with nothing imported
 * never grows a filter for a distinction that doesn't apply to it. It matters
 * because the two populations are wildly different sizes: hundreds of imported
 * skeletons would otherwise bury the handful of sessions with real set data.
 */
function SourceFilterRail({
  selectedSource,
  selectedTemplateId,
  recordedCount,
  importedCount,
  isPreviewMode,
}: SourceFilterRailProps): JSX.Element {
  const options: Array<{ value: WorkoutSourceFilter | null; label: string; count: number }> = [
    { value: null, label: 'All', count: recordedCount + importedCount },
    { value: 'recorded', label: 'Recorded', count: recordedCount },
    { value: 'imported', label: 'Apple Health', count: importedCount },
  ]

  return (
    <nav aria-label="Filter by source" data-testid="workout-source-filter">
      <ul className="flex flex-wrap gap-2">
        {options.map(option => {
          const isActive = option.value === selectedSource
          return (
            <li key={option.value ?? 'all'}>
              <Link
                href={chipHref(selectedTemplateId, option.value, isPreviewMode)}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`workout-source-${option.value ?? 'all'}`}
                className={chipClass(isActive)}
              >
                {option.label}
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

function TemplateFilterRail({
  filters,
  selectedTemplateId,
  selectedSource,
  isPreviewMode,
}: TemplateFilterRailProps): JSX.Element {
  return (
    <nav aria-label="Filter by template" data-testid="workout-template-filter">
      <ul className="flex flex-wrap gap-2">
        {filters.map(option => {
          const isActive = option.id === selectedTemplateId
          return (
            <li key={option.id ?? 'all'}>
              <Link
                href={chipHref(option.id, selectedSource, isPreviewMode)}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`workout-filter-${option.id ?? 'all'}`}
                className={chipClass(isActive)}
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

/**
 * Format a session's start as `Fri, Aug 1` — the year only when it isn't this one.
 *
 * Resolved through the Pacific day key rather than formatted off the raw
 * instant. This renders in a Server Component and Vercel runs in UTC, so a
 * session starting Friday 10pm Pacific would otherwise be labelled Saturday —
 * disagreeing with `workoutDayKey`, which deliberately assigns that whole
 * session to Friday.
 */
function formatStart(startedAt: string): string {
  const dayKey = safePacificDayKey(startedAt)
  if (dayKey === '') return 'Unknown date'
  const sameYear = dayKey.slice(0, 4) === todayDayKey().slice(0, 4)
  return formatDayKey(dayKey, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function WorkoutHistoryRow({ entry, isPreviewMode }: WorkoutHistoryRowProps): JSX.Element {
  const { summary, workout } = entry
  const isImported = workout.source === 'apple_health'
  // An imported session has no title and no template, so "Freestyle session" —
  // which means "I chose not to follow a plan" — would be a claim about intent
  // that nothing supports. It says what it is instead.
  const heading =
    entry.templateName ?? workout.title ?? (isImported ? 'Strength training' : 'Freestyle session')
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
          {isImported ? (
            <span
              data-testid="workout-imported-badge"
              className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[#0a0a0a]/65"
            >
              Apple Health
            </span>
          ) : null}
        </h3>
        <p className="text-xs text-[#0a0a0a]/60">{formatStart(workout.started_at)}</p>
      </header>

      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tabular-nums">
        {/* An imported session's zeros are unknowns, not measurements, so the
            set/rep counts are simply not shown for one with nothing logged. */}
        {isImported && summary.totalSets === 0 ? null : (
          <>
            <span>
              <span className="font-bold">{summary.totalSets}</span>
              <span className="text-[#0a0a0a]/55"> sets</span>
            </span>
            <span>
              <span className="font-bold">{summary.totalReps.toLocaleString('en-US')}</span>
              <span className="text-[#0a0a0a]/55"> reps</span>
            </span>
          </>
        )}
        {workout.avg_hr !== undefined ? (
          <span>
            <span className="font-bold">{Math.round(workout.avg_hr)}</span>
            <span className="text-[#0a0a0a]/55"> avg bpm</span>
          </span>
        ) : null}
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
