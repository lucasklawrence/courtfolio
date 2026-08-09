import type { JSX } from 'react'
import Link from 'next/link'

import { formatDayKey, safePacificDayKey, todayDayKey } from '@/lib/training-facility/day-keys'
import { describeSetOrHold } from '@/lib/training-facility/strength-format'
import {
  workoutDisplayTitle,
  type WorkoutHistoryEntry,
  type WorkoutYearOption,
} from '@/lib/training-facility/workout-stats'

/** Route the workout history lives at; also the base for every filter chip. */
export const WORKOUTS_ROUTE = '/training-facility/weight-room/workouts'

/** URL param naming the provenance filter (#413). */
export const SOURCE_FILTER_PARAM = 'source'

/** URL param naming the year filter (#416). Value is a year, or `all`. */
export const YEAR_FILTER_PARAM = 'year'

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
  /** Years that have sessions, newest first (#416). Empty hides the year rail. */
  years?: readonly WorkoutYearOption[]
  /** Selected year, or `null` for all years. */
  selectedYear?: number | null
  /** Current 1-based page. */
  page?: number
  /** Total pages for the current filter set. */
  totalPages?: number
  /** Entries across every page, for the "showing N of M" line. */
  totalEntries?: number
  /** 1-based index of the first row on this page, from `paginateWorkouts`. */
  startIndex?: number
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
  years = [],
  selectedYear = null,
  page = 1,
  totalPages = 1,
  totalEntries = 0,
  startIndex = 1,
}: WorkoutHistoryListProps): JSX.Element {
  const filterState: FilterState = {
    selectedTemplateId,
    selectedSource,
    selectedYear,
    isPreviewMode,
  }
  return (
    <div className="flex flex-col gap-5">
      {years.length > 1 ? <YearFilterRail years={years} filterState={filterState} /> : null}

      {importedCount > 0 ? (
        <SourceFilterRail
          filterState={filterState}
          recordedCount={recordedCount}
          importedCount={importedCount}
        />
      ) : null}

      {filters.length > 1 ? (
        <TemplateFilterRail filters={filters} filterState={filterState} />
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
        <>
          <ul data-testid="workout-history" className="flex flex-col gap-3">
            {entries.map(entry => (
              <li key={entry.workout.id}>
                <WorkoutHistoryRow entry={entry} isPreviewMode={isPreviewMode} />
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalEntries={totalEntries}
              shown={entries.length}
              startIndex={startIndex}
              filterState={filterState}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

interface TemplateFilterRailProps {
  filters: readonly TemplateFilterOption[]
  filterState: FilterState
}

/**
 * The filters currently applied, as the URL expresses them.
 *
 * Passed around whole so a chip can rebuild the URL with **one** axis changed
 * and the rest preserved. Choosing a template must not silently clear the year,
 * and neither may drop `preview=demo` — the fixture only stands in when the real
 * read is empty, so losing that param ends the demo mid-tour.
 */
interface FilterState {
  selectedTemplateId: string | null
  selectedSource: WorkoutSourceFilter | null
  /** `null` means *all years*, which is an explicit `year=all`, not an absent param. */
  selectedYear: number | null
  isPreviewMode: boolean
}

/**
 * Build a href for a chip that changes one filter and keeps the others.
 *
 * `year` is always emitted, because absent means "newest year" rather than
 * "every year" (#416) — leaving it off would silently snap an all-years view
 * back to the default the moment any other chip was clicked.
 *
 * `page` is omitted when it is 1, and **reset on every filter change**: page 4
 * of one filter set has nothing to do with page 4 of another, and carrying it
 * over lands the reader on a clamped page with no explanation.
 */
function chipHref(
  state: FilterState,
  override: Partial<FilterState & { page: number }> = {}
): string {
  const next = { ...state, ...override }
  const params = new URLSearchParams()
  if (next.selectedTemplateId !== null) params.set('template', next.selectedTemplateId)
  if (next.selectedSource !== null) params.set(SOURCE_FILTER_PARAM, next.selectedSource)
  params.set(YEAR_FILTER_PARAM, next.selectedYear === null ? 'all' : String(next.selectedYear))
  if (override.page !== undefined && override.page > 1) params.set('page', String(override.page))
  if (next.isPreviewMode) params.set('preview', 'demo')
  return `${WORKOUTS_ROUTE}?${params.toString()}`
}

/** Shared chip styling, so the two rails can't drift apart visually. */
function chipClass(isActive: boolean): string {
  return isActive
    ? 'inline-flex items-center gap-1.5 rounded-full bg-[#f5f1e6] px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#0a0a0a]'
    : 'inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#e8d5be]/75 transition hover:border-white/35 hover:text-[#f7ead9]'
}

interface SourceFilterRailProps {
  filterState: FilterState
  recordedCount: number
  importedCount: number
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
  filterState,
  recordedCount,
  importedCount,
}: SourceFilterRailProps): JSX.Element {
  const selectedSource = filterState.selectedSource
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
                href={chipHref(filterState, { selectedSource: option.value })}
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

function TemplateFilterRail({ filters, filterState }: TemplateFilterRailProps): JSX.Element {
  const selectedTemplateId = filterState.selectedTemplateId
  return (
    <nav aria-label="Filter by template" data-testid="workout-template-filter">
      <ul className="flex flex-wrap gap-2">
        {filters.map(option => {
          const isActive = option.id === selectedTemplateId
          return (
            <li key={option.id ?? 'all'}>
              <Link
                href={chipHref(filterState, { selectedTemplateId: option.id })}
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
  const heading = workoutDisplayTitle(workout, entry.templateName)
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
          Top set · {topLift.displayName ?? topLift.exercise} {describeSetOrHold(topLift.topSet)}
        </p>
      ) : null}
    </Link>
  )
}

interface YearFilterRailProps {
  years: readonly WorkoutYearOption[]
  filterState: FilterState
}

/**
 * Year rail (#416) — the filter that keeps this page bounded.
 *
 * The default view is the newest year rather than everything: after the Apple
 * Health import (#413) the unfiltered list was 507 rows and 1.4 MB, on the
 * landing view of a sub-nav pill.
 *
 * Years with no sessions are absent rather than rendered empty, so the rail
 * shows the shape of the training history — including its gaps — instead of a
 * uniform run of years that implies continuity that wasn't there.
 */
function YearFilterRail({ years, filterState }: YearFilterRailProps): JSX.Element {
  const total = years.reduce((n, y) => n + y.count, 0)
  return (
    <nav aria-label="Filter by year" data-testid="workout-year-filter">
      <ul className="flex flex-wrap gap-2">
        {years.map(option => {
          const isActive = option.year === filterState.selectedYear
          return (
            <li key={option.year}>
              <Link
                href={chipHref(filterState, { selectedYear: option.year })}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`workout-year-${option.year}`}
                className={chipClass(isActive)}
              >
                {option.year}
                <span className={isActive ? 'text-[#0a0a0a]/50' : 'text-[#e8d5be]/45'}>
                  {option.count}
                </span>
              </Link>
            </li>
          )
        })}
        <li>
          <Link
            href={chipHref(filterState, { selectedYear: null })}
            aria-current={filterState.selectedYear === null ? 'page' : undefined}
            data-testid="workout-year-all"
            className={chipClass(filterState.selectedYear === null)}
          >
            All years
            <span
              className={
                filterState.selectedYear === null ? 'text-[#0a0a0a]/50' : 'text-[#e8d5be]/45'
              }
            >
              {total}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  totalEntries: number
  shown: number
  /** 1-based index of the first row shown, supplied by `paginateWorkouts`. */
  startIndex: number
  filterState: FilterState
}

/**
 * Prev / next pagination for the current filter set (#416).
 *
 * Applies to any filter, not only "All years": 2022 alone is 152 sessions, so a
 * year filter on its own still ships a heavy page.
 *
 * Renders links rather than buttons so the page stays a Server Component and
 * each page is a real, shareable URL — the same reason the filters are URL
 * params (#377).
 */
function Pagination({
  page,
  totalPages,
  totalEntries,
  shown,
  startIndex,
  filterState,
}: PaginationProps): JSX.Element {
  return (
    <nav
      aria-label="Pagination"
      data-testid="workout-pagination"
      className="flex flex-wrap items-center justify-between gap-3 pt-1"
    >
      <p className="text-xs text-[#e8d5be]/60">
        Showing {startIndex}–{startIndex + shown - 1} of {totalEntries}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={chipHref(filterState, { page: page - 1 })}
            data-testid="workout-page-prev"
            className={chipClass(false)}
          >
            ← Newer
          </Link>
        ) : null}
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#e8d5be]/50">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={chipHref(filterState, { page: page + 1 })}
            data-testid="workout-page-next"
            className={chipClass(false)}
          >
            Older →
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
