import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import {
  ExerciseProgressionPanel,
  exerciseTrendHref,
} from '@/components/training-facility/weight-room/ExerciseProgressionPanel'
import { TemplateCompositionPanel } from '@/components/training-facility/weight-room/TemplateCompositionPanel'
import { TemplateRunCharts } from '@/components/training-facility/weight-room/TemplateRunCharts'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { buildWorkoutDemoData } from '@/constants/weight-room-demo-fixture'
import { isAdminRequest } from '@/lib/auth/admin-session'
import {
  getWeightRoomDataServer,
  getWeightRoomWorkoutsServer,
  getWorkoutTemplatesServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { formatDayKey } from '@/lib/training-facility/day-keys'
import {
  buildExerciseProgression,
  buildSetDetailCoverage,
} from '@/lib/training-facility/exercise-progression'
import { buildExerciseLabels, slugLabel } from '@/lib/training-facility/exercise-labels'
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'
import {
  buildTemplateHistory,
  resolveTemplate,
  templateRunIds,
} from '@/lib/training-facility/template-history'
import { buildWorkoutHistory } from '@/lib/training-facility/workout-stats'

/** Route + search params for the per-template view. */
interface PageProps {
  /** Async per-request route params (Next 15+). `slug` names the template. */
  params: Promise<{ slug: string }>
  /** Async per-request search params; only `preview` is consumed. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Session log route, for the breadcrumb back-link. */
const WORKOUTS_ROUTE = '/training-facility/weight-room/workouts'

/**
 * A movement needs two training days before a trend means anything; below that
 * the panel renders its own single-day note instead of a collapsed axis.
 */
const MIN_PANEL_DAYS = 2

/**
 * Per-template view (#446) — one workout, trended as a workout.
 *
 * The room could already show a movement over time (#412) and a single session
 * in detail (#377), but the unit training is actually *planned* in sat between
 * them: "how is Chest Day 1 going" meant opening four movement pages and doing
 * the joining by eye.
 *
 * Two halves. The whole-workout charts treat each run as one point — tonnage,
 * volume, duration — and the per-movement panels below reuse the #412 trend,
 * narrowed to the sets logged *in this workout*, so a lift that also appears
 * elsewhere trends here only on the days this session ran it.
 *
 * A leaf page, like the per-exercise view: no sub-nav pill, because it's about
 * one workout rather than a section of the room.
 */
export default async function WeightRoomTemplatePage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const [{ slug }, query, realWorkouts, data, realTemplates, isAdmin] = await Promise.all([
    params,
    searchParams,
    getWeightRoomWorkoutsServer().catch(() => []),
    getWeightRoomDataServer().catch(() => null),
    getWorkoutTemplatesServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  // Same contract as every other Weight Room surface: the fixture stands in
  // only when the real read is empty, so it can never sit in front of real
  // training.
  const isPreviewMode = realWorkouts.length === 0 && isPreviewDemoActive(query.preview)
  const demo = isPreviewMode ? buildWorkoutDemoData() : null

  const workouts = demo?.workouts ?? realWorkouts
  const sets = demo?.sets ?? data?.sets ?? []
  const templates = demo?.templates ?? realTemplates
  const exercises = demo?.exercises ?? data?.exercises ?? []

  // Slugs are derived from the name at request time, so match case-insensitively
  // — a hand-typed `/templates/Chest-Day-1` should find the same workout.
  const template = resolveTemplate(slug.toLowerCase(), templates)
  if (template === null) notFound()

  const history = buildWorkoutHistory(workouts, sets, templates, exercises)
  const templateHistory = buildTemplateHistory(template, history)
  const runIds = templateRunIds(templateHistory)

  // Narrowed to this workout's own sessions, so a movement that also runs
  // elsewhere trends here only on the days this template ran it. Loose sets
  // carry no `workout_id` and are excluded by the same test.
  const templateSets = sets.filter(
    set => set.workout_id !== undefined && runIds.has(set.workout_id)
  )
  const exerciseLabels = buildExerciseLabels(exercises)

  const panels = templateHistory.movements
    .map(movement => ({
      movement,
      progression: buildExerciseProgression(
        movement.exercise,
        templateSets,
        exercises,
        workouts.filter(workout => runIds.has(workout.id))
      ),
    }))
    .filter(entry => (entry.progression?.points.length ?? 0) >= MIN_PANEL_DAYS)

  const ranged =
    templateHistory.firstDayKey === ''
      ? null
      : `${formatDayKey(templateHistory.firstDayKey, { month: 'short', year: 'numeric' })} – ${formatDayKey(
          templateHistory.lastDayKey,
          { month: 'short', year: 'numeric' }
        )}`

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
              href={isPreviewMode ? `${WORKOUTS_ROUTE}?preview=demo` : WORKOUTS_ROUTE}
              className="underline-offset-4 hover:underline"
            >
              Session log
            </Link>
          </p>
          <h1
            className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl"
            style={template.color === undefined ? undefined : { color: template.color }}
          >
            {template.name}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            {templateHistory.runs.length === 0
              ? 'This workout has no recorded sessions yet. Its charts start at the first one.'
              : `${templateHistory.runs.length} sessions${ranged === null ? '' : ` · ${ranged}`} — the workout as a whole, then each movement in it.`}
          </p>
          <WeightRoomSubNav active="workouts" className="mt-5" isAdmin={isAdmin} />
        </header>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="These sessions are illustrative — not Lucas’s real training log." />
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-8 pb-16" data-testid={`template-${template.id}`}>
          <TemplateRunCharts
            history={templateHistory}
            {...(template.color === undefined ? {} : { accentColor: template.color })}
          />

          <TemplateCompositionPanel
            history={templateHistory}
            exerciseLabels={exerciseLabels}
            exerciseHref={slug => exerciseTrendHref(slug, isPreviewMode)}
          />

          {panels.length > 0 ? (
            <section className="flex flex-col gap-8" data-testid="template-movement-panels">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
                Movement by movement
              </h2>
              {panels.map(({ movement, progression }) =>
                progression === null ? null : (
                  <ExerciseProgressionPanel
                    key={movement.exercise}
                    progression={progression}
                    displayName={slugLabel(movement.exercise, undefined, exerciseLabels)}
                    coverage={buildSetDetailCoverage(
                      progression.points[0]?.dayKey ?? null,
                      workouts.filter(workout => runIds.has(workout.id)),
                      templateSets
                    )}
                    {...(template.color === undefined ? {} : { accentColor: template.color })}
                  />
                )
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
