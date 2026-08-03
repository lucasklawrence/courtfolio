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
  type WorkoutSourceFilter,
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
  buildWorkoutHistory,
  paginateWorkouts,
  workoutYear,
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

  // Chips are built from what has actually been *run*, not from the template
  // roster: a template nobody has recorded a session against would otherwise
  // render a chip that filters to an empty list.
  const counts = new Map<string, number>()
  for (const entry of history) {
    const id = entry.workout.template_id
    if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const templateById = new Map(sourceTemplates.map(t => [t.id, t]))
  const filters: TemplateFilterOption[] = [
    { id: null, name: 'All', color: null, count: history.length },
    ...[...counts.entries()]
      .map(([id, count]) => ({
        id,
        name: templateById.get(id)?.name ?? 'Unknown template',
        color: templateById.get(id)?.color ?? null,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]

  // Provenance is a second, independent filter axis (#413). Hundreds of
  // imported skeletons would otherwise bury the handful of sessions that carry
  // real set data.
  const recordedCount = history.filter(e => e.workout.source !== 'apple_health').length
  const importedCount = history.length - recordedCount
  const requestedSource = firstParam(params.source)
  const selectedSource: WorkoutSourceFilter | null =
    requestedSource === 'recorded' || requestedSource === 'imported' ? requestedSource : null

  const requestedTemplate = firstParam(params.template)
  // An unknown id falls back to "all" rather than to an empty list — a stale
  // link naming a deleted template should degrade to the full history.
  const selectedTemplateId =
    requestedTemplate !== null && counts.has(requestedTemplate) ? requestedTemplate : null
  // Year is the third filter axis, and the one that keeps the page bounded
  // (#416). Before it, the default view rendered every session ever recorded —
  // 507 rows and 1.4 MB after the Health import landed.
  const years = workoutYearOptions(history)
  const requestedYear = firstParam(params.year)
  // Default to the newest year with sessions rather than to everything. An
  // unrecognised value also lands here, so a stale link degrades to a small,
  // useful page instead of the heaviest one.
  const selectedYear: number | null =
    requestedYear === 'all'
      ? null
      : (years.find(y => String(y.year) === requestedYear)?.year ?? years[0]?.year ?? null)

  const filtered = history.filter(entry => {
    if (selectedTemplateId !== null && entry.workout.template_id !== selectedTemplateId) {
      return false
    }
    if (selectedYear !== null && workoutYear(entry) !== selectedYear) return false
    if (selectedSource === null) return true
    const isImported = entry.workout.source === 'apple_health'
    return selectedSource === 'imported' ? isImported : !isImported
  })

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
