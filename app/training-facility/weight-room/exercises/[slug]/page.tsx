import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { ExerciseProgressionPanel } from '@/components/training-facility/weight-room/ExerciseProgressionPanel'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { buildWeightRoomDemoData, buildWorkoutDemoData } from '@/constants/weight-room-demo-fixture'
import { isAdminRequest } from '@/lib/auth/admin-session'
import {
  getWeightRoomDataServer,
  getWeightRoomExercisesServer,
  getWeightRoomWorkoutsServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import {
  buildExerciseProgression,
  buildSetDetailCoverage,
} from '@/lib/training-facility/exercise-progression'
import { buildExerciseLabels, slugLabel } from '@/lib/training-facility/exercise-labels'
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'

/** Route + search params for the per-exercise trend. */
interface PageProps {
  /** Async per-request route params (Next 15+). `slug` is the movement's catalog slug. */
  params: Promise<{ slug: string }>
  /** Async per-request search params; only `preview` is consumed. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** History route, for the breadcrumb back-link. */
const HISTORY_ROUTE = '/training-facility/weight-room/history'

/**
 * Per-exercise strength view (#412) — one movement trended over time.
 *
 * Public and read-only, like the rest of the Weight Room. Reached from the
 * per-exercise rows of a workout summary and from the History view's exercise
 * cards; there's deliberately no sub-nav pill, because this is a leaf about one
 * movement rather than a section of the room.
 *
 * A movement with a catalog row but no logged sets renders an empty state rather
 * than a 404 — a movement added to the roster before its first session is a
 * normal state, not a bad URL. A slug that's in neither the log nor the catalog
 * is a bad URL, and 404s.
 */
export default async function WeightRoomExercisePage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const [{ slug }, query, data, realExercises, realWorkouts, isAdmin] = await Promise.all([
    params,
    searchParams,
    getWeightRoomDataServer().catch(() => null),
    // The roster is read on its own rather than taken off `data.exercises`:
    // `assembleWeightRoomData` answers `null` when the sets and goals tables are
    // both empty, which would drop the catalog with them and 404 a movement that
    // is on the roster and simply hasn't been trained yet.
    getWeightRoomExercisesServer().catch(() => []),
    getWeightRoomWorkoutsServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  // Slugs are stored lowercase (the API lowercases on write), so a hand-typed
  // `/exercises/Pushups` should find the same movement rather than 404.
  const exercise = slug.toLowerCase()
  const realSets = data?.sets ?? []

  // Same contract as every other Weight Room surface: the fixture is reachable
  // only when the real read is empty, so it can never stand in front of real
  // training.
  //
  // Both fixtures, because this page is reached from both sides: the History
  // cards link movements that live in the grease-the-groove fixture, the workout
  // breakdown links ones that live in the gym fixture, and a preview tour
  // arriving from either must not dead-end on a 404. It also means the demo
  // shows both registers — bodyweight reps and loaded work whose low-rep sets
  // are, for now, the only thing the estimated-1RM overlay has to draw.
  const isPreviewMode = realSets.length === 0 && isPreviewDemoActive(query.preview)
  const grooveDemo = isPreviewMode ? buildWeightRoomDemoData() : null
  const workoutDemo = isPreviewMode ? buildWorkoutDemoData() : null

  const sets = isPreviewMode
    ? [...(grooveDemo?.sets ?? []), ...(workoutDemo?.sets ?? [])]
    : realSets
  const exercises = workoutDemo?.exercises ?? realExercises
  const goals = grooveDemo?.goals ?? data?.goals ?? []
  const workouts = workoutDemo?.workouts ?? realWorkouts

  const progression = buildExerciseProgression(exercise, sets, exercises, workouts)
  const catalogRow = exercises.find(e => e.slug === exercise)
  const goal = goals.find(g => g.exercise === exercise)
  if (progression === null && catalogRow === undefined) notFound()

  // Catalog first, then the label joined onto a goal, then the slug (#384) — the
  // grease-the-groove movements carry no catalog row of their own.
  const displayName = slugLabel(exercise, goal, buildExerciseLabels(exercises))
  const coverage = buildSetDetailCoverage(progression?.points[0]?.dayKey ?? null, workouts, sets)
  // The movement's own color where it has a daily goal, so the trend matches the
  // ring and heatmap it's already drawn in elsewhere. Gym lifts have no goal and
  // fall back to the panel's default.
  const goalColor = goal?.color

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
            {/* Keeps the preview alive on the way back — without the param the
                read is empty again and the demo vanishes mid-tour. */}
            <Link
              href={isPreviewMode ? `${HISTORY_ROUTE}?preview=demo` : HISTORY_ROUTE}
              className="underline-offset-4 hover:underline"
            >
              History
            </Link>
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            {displayName}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            One movement over time — the heaviest set of each training day, what it implies about a
            one-rep max, and how many reps went into a single set. Loose sets and recorded sessions
            count the same; the day is the unit.
          </p>
          <WeightRoomSubNav active="exercises" className="mt-5" isAdmin={isAdmin} />
        </header>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="This movement’s history is illustrative — not Lucas’s real training log." />
          </div>
        ) : null}

        <div className="mt-8 pb-16">
          {progression === null ? (
            <p
              data-testid="exercise-progression-empty"
              className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
            >
              No {displayName} sets logged yet. This movement is on the roster; the trend starts at
              its first recorded set.
            </p>
          ) : (
            <ExerciseProgressionPanel
              progression={progression}
              displayName={displayName}
              coverage={coverage}
              {...(goalColor === undefined ? {} : { accentColor: goalColor })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
