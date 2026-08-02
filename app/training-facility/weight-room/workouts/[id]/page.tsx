import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { WORKOUTS_ROUTE } from '@/components/training-facility/weight-room/WorkoutHistoryList'
import { WorkoutSummaryPanel } from '@/components/training-facility/weight-room/WorkoutSummaryPanel'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isAdminRequest } from '@/lib/auth/admin-session'
import {
  getWeightRoomDataServer,
  getWeightRoomWorkoutsServer,
  getWorkoutTemplatesServer,
} from '@/lib/data/weight-room-server'
import { buildWorkoutDemoData } from '@/constants/weight-room-demo-fixture'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'
import {
  buildWorkoutAdherence,
  buildWorkoutSummary,
  compareToPrevious,
  findPersonalBests,
  findPreviousRun,
} from '@/lib/training-facility/workout-stats'

/** Route params for the per-workout summary. */
interface PageProps {
  /** Async per-request route params (Next 15+). */
  params: Promise<{ id: string }>
  /** Async per-request search params; only `preview` is consumed. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Per-workout summary (#377) — the payoff screen of the #372 arc.
 *
 * Public and read-only. Renders for any recorded session: one that ran a
 * template gets prescribed-vs-actual and a comparison against the previous run;
 * a freestyle session gets everything except those two blocks; an in-progress or
 * never-ended session gets running totals and says which it is.
 */
export default async function WeightRoomWorkoutSummaryPage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const [{ id }, query, realWorkouts, data, realTemplates, isAdmin] = await Promise.all([
    params,
    searchParams,
    getWeightRoomWorkoutsServer().catch(() => []),
    getWeightRoomDataServer().catch(() => null),
    getWorkoutTemplatesServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  // Same contract as the list and every other Weight Room surface: the fixture
  // is reachable only when the real read is empty, so it can never stand in
  // front of a real session.
  const isPreviewMode = realWorkouts.length === 0 && isPreviewDemoActive(query.preview)
  const demo = isPreviewMode ? buildWorkoutDemoData() : null

  const workouts = demo?.workouts ?? realWorkouts
  const allSets = demo?.sets ?? data?.sets ?? []
  const exercises = demo?.exercises ?? data?.exercises ?? []
  const templates = demo?.templates ?? realTemplates

  const workout = workouts.find(w => w.id === id)
  if (workout === undefined) notFound()

  const workoutSets = allSets.filter(set => set.workout_id === workout.id)

  const template =
    workout.template_id === undefined
      ? null
      : (templates.find(t => t.id === workout.template_id) ?? null)

  const summary = buildWorkoutSummary(workout, workoutSets, exercises)
  // Adherence only means something against a prescription. A freestyle session
  // renders everything else rather than an empty "0 of 0 slots" block.
  const adherence = template === null ? null : buildWorkoutAdherence(template, workoutSets)

  const previousWorkout = findPreviousRun(workout, workouts)
  const previousSummary =
    previousWorkout === null
      ? null
      : buildWorkoutSummary(
          previousWorkout,
          allSets.filter(set => set.workout_id === previousWorkout.id),
          exercises
        )
  const comparison = compareToPrevious(summary, previousSummary)
  const personalBests = findPersonalBests(summary, allSets, exercises)

  const exerciseLabels: Record<string, string> = {}
  for (const exercise of exercises) exerciseLabels[exercise.slug] = exercise.display_name

  const started = new Date(workout.started_at)
  const startedLabel = Number.isFinite(started.getTime())
    ? started.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown date'
  const heading = template?.name ?? workout.title ?? 'Freestyle session'

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
            Weight Room ·{' '}
            <Link href={WORKOUTS_ROUTE} className="underline-offset-4 hover:underline">
              Workouts
            </Link>
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            {heading}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#e8d5be] sm:text-base">{startedLabel}</p>
          {workout.notes !== undefined ? (
            <p
              data-testid="workout-notes"
              className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be]/75"
            >
              {workout.notes}
            </p>
          ) : null}
          <WeightRoomSubNav active="workouts" className="mt-5" isAdmin={isAdmin} />
        </header>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="This session is illustrative — not one of Lucas’s real workouts." />
          </div>
        ) : null}

        <div className="mt-8 pb-16">
          <WorkoutSummaryPanel
            summary={summary}
            adherence={adherence}
            comparison={comparison}
            personalBests={personalBests}
            templateName={template?.name ?? null}
            exerciseLabels={exerciseLabels}
          />
        </div>
      </div>
    </div>
  )
}
