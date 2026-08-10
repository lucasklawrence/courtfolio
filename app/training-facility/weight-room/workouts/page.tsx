import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import {
  WorkoutHistoryList,
  WORKOUTS_ROUTE,
  type TemplateFilterOption,
} from '@/components/training-facility/weight-room/WorkoutHistoryList'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isAdminRequest } from '@/lib/auth/admin-session'
import { buildWorkoutDemoData } from '@/constants/weight-room-demo-fixture'
import {
  getWeightRoomDataServer,
  getWeightRoomWorkoutsServer,
  getWorkoutTemplatesServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'
import {
  facetCount,
  filterWorkouts,
  isImported,
  resolveSourceFilter,
  type WorkoutFilterState,
} from '@/lib/training-facility/workout-facets'
import {
  buildWorkoutHistory,
  paginateWorkouts,
  workoutYearOptions,
} from '@/lib/training-facility/workout-stats'

/** Search-params shape Next.js passes to a server-rendered page. */
interface PageProps {
  /** Async per-request context (Next 15+). `template` filters; `preview` opts into the fixture. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Read the first value of a param that may arrive repeated. */
function firstParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Workout history (#377) — every recorded session, newest first, filterable by
 * the template it ran and clicking through to that session's summary.
 *
 * Public and read-only like the rest of the Weight Room; only the recording
 * surface at `/log` is admin-gated.
 *
 * Empty-state preview (`?preview=demo`): with no recorded sessions the page
 * substitutes {@link buildWorkoutDemoData}, the same contract the Today and
 * History views use. Gated on the real read being empty, so it can never
 * overlay or misrepresent real training.
 */
export default async function WeightRoomWorkoutsPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const [workouts, data, templates, isAdmin] = await Promise.all([
    getWeightRoomWorkoutsServer().catch(() => []),
    getWeightRoomDataServer().catch(() => null),
    getWorkoutTemplatesServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  const params = await searchParams
  const previewRequested = isPreviewDemoActive(params.preview)
  const realIsEmpty = workouts.length === 0
  const isPreviewMode = realIsEmpty && previewRequested
  const showEmptyStateCta = realIsEmpty && !previewRequested

  const demo = isPreviewMode ? buildWorkoutDemoData() : null
  const sourceWorkouts = demo?.workouts ?? workouts
  const sourceSets = demo?.sets ?? data?.sets ?? []
  const sourceTemplates = demo?.templates ?? templates
  const sourceExercises = demo?.exercises ?? data?.exercises ?? []

  const history = buildWorkoutHistory(sourceWorkouts, sourceSets, sourceTemplates, sourceExercises)

  // Templates that have actually been *run*, not the roster: a template nobody
  // has recorded a session against would otherwise render a chip that filters
  // to an empty list.
  const everRun = new Set<string>()
  for (const entry of history) {
    const id = entry.workout.template_id
    if (id !== undefined) everRun.add(id)
  }

  // Whether the provenance rail exists at all is a question about the log, not
  // the current view — and it has to be answered before the param is read, or
  // `?source=imported` on a log with no imports empties the page while the rail
  // that would undo it isn't rendered.
  const hasImported = history.some(isImported)
  const selectedSource = resolveSourceFilter(firstParam(params.source), hasImported)

  const requestedTemplate = firstParam(params.template)
  // Validated against what was *run*, not against the current roster. An id no
  // session ever used falls back to "all" rather than to an empty list, so a
  // stale link degrades to the full history.
  //
  // A template deleted from the roster but still referenced by old sessions
  // deliberately stays selectable, labelled "Unknown template" further down:
  // those sessions are real and filtering to them is a true answer, where
  // dropping the filter would silently discard it. A template that exists but
  // has nothing under the *current* year also stays selected — its chip renders
  // at 0, so the reader can see why the list is empty and click out of it.
  const selectedTemplateId =
    requestedTemplate !== null && everRun.has(requestedTemplate) ? requestedTemplate : null

  // Year is the third filter axis, and the one that keeps the page bounded
  // (#416). Before it, the default view rendered every session ever recorded —
  // 507 rows and 1.4 MB after the Health import landed.
  //
  // Resolved *after* the other two axes, because its counts and its default
  // both depend on them (#445): the year rail under a template filter should
  // offer the years that template actually ran, and default to one of them.
  const otherAxes: WorkoutFilterState = {
    templateId: selectedTemplateId,
    source: selectedSource,
    year: null,
  }
  const years = workoutYearOptions(history)
    .map(option => ({
      year: option.year,
      count: facetCount(history, otherAxes, { year: option.year }),
    }))
    .filter(option => option.count > 0)

  const requestedYear = firstParam(params.year)
  // Default to the newest year that has anything under the other filters,
  // rather than the newest year overall — which, with a template selected,
  // routinely isn't a year that template ran. An unrecognised value lands here
  // too, so a stale link degrades to a small, useful page rather than the
  // heaviest one.
  const selectedYear: number | null =
    requestedYear === 'all'
      ? null
      : (years.find(y => String(y.year) === requestedYear)?.year ?? years[0]?.year ?? null)

  // Every chip's count is measured against the history filtered by the *other*
  // two axes (#445) — the exact state its own link navigates to. Tallying over
  // the whole log instead is what put "Apple Health 507" above a list of 22,
  // since the year axis is always active by default.
  const filterState: WorkoutFilterState = {
    templateId: selectedTemplateId,
    year: selectedYear,
    source: selectedSource,
  }
  const filtered = filterWorkouts(history, filterState)

  const templateById = new Map(sourceTemplates.map(t => [t.id, t]))
  const filters: TemplateFilterOption[] = [
    {
      id: null,
      name: 'All',
      color: null,
      count: facetCount(history, filterState, { templateId: null }),
    },
    ...[...everRun]
      .map(id => ({
        id,
        name: templateById.get(id)?.name ?? 'Unknown template',
        color: templateById.get(id)?.color ?? null,
        count: facetCount(history, filterState, { templateId: id }),
      }))
      // Unreachable chips are dropped rather than shown at 0 — a chip is an
      // offer, and one that leads nowhere is noise. The selected template is
      // the exception: it has to stay visible to be undoable.
      .filter(option => option.count > 0 || option.id === selectedTemplateId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]

  // Provenance is a second, independent filter axis (#413). Hundreds of
  // imported skeletons would otherwise bury the handful of sessions that carry
  // real set data.
  const recordedCount = facetCount(history, filterState, { source: 'recorded' })
  const importedCount = facetCount(history, filterState, { source: 'imported' })

  // Paginate whatever the filters left, not just the all-years view: 2022 alone
  // is 152 sessions, so a year filter on its own still ships a heavy page.
  const requestedPage = Number(firstParam(params.page) ?? '1')
  const pageResult = paginateWorkouts(filtered, requestedPage)
  const entries = pageResult.entries

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.16),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <FacilityBackLink />
        </div>

        <header className="mt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Weight Room · Workouts
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Session log
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Every recorded gym session, newest first — sets, reps, weight moved, and how long it
            took. Open one for the full breakdown: what the template prescribed, what actually
            happened, and how it stacked up against last time.
          </p>
          <WeightRoomSubNav active="workouts" className="mt-5" isAdmin={isAdmin} />
        </header>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="These sessions are illustrative — not Lucas’s real training log." />
          </div>
        ) : null}

        {showEmptyStateCta ? (
          <div className="mt-6 max-w-md">
            <PreviewWithSampleDataButton
              href={`${WORKOUTS_ROUTE}?preview=demo`}
              headline="No workouts recorded yet"
              description="Curious what a session summary looks like? Load a sample workout to see prescribed-vs-actual, tonnage, and the comparison against the last run."
            />
          </div>
        ) : null}

        <div className="mt-8 pb-16">
          <WorkoutHistoryList
            entries={entries}
            filters={filters}
            selectedTemplateId={selectedTemplateId}
            hasAnyWorkouts={history.length > 0}
            isPreviewMode={isPreviewMode}
            selectedSource={selectedSource}
            recordedCount={recordedCount}
            importedCount={importedCount}
            hasImported={hasImported}
            years={years}
            selectedYear={selectedYear}
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            totalEntries={pageResult.totalEntries}
            startIndex={pageResult.startIndex}
          />
        </div>
      </div>
    </div>
  )
}
