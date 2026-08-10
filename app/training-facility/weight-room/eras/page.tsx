import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { EraCadenceChart } from '@/components/training-facility/weight-room/EraCadenceChart'
import { EraContrastPanel } from '@/components/training-facility/weight-room/EraContrastPanel'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { buildWeightRoomDemoData, buildWorkoutDemoData } from '@/constants/weight-room-demo-fixture'
import { isAdminRequest } from '@/lib/auth/admin-session'
import {
  getWeightRoomDataServer,
  getWeightRoomExercisesServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { buildExerciseLabels } from '@/lib/training-facility/exercise-labels'
import { buildLogEras } from '@/lib/training-facility/log-eras'
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'

/** Search params for the eras view. */
interface PageProps {
  /** Async per-request search params; only `preview` is consumed. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** History route, for the breadcrumb back-link. */
const HISTORY_ROUTE = '/training-facility/weight-room/history'

/**
 * Two eras of the whole log (#437).
 *
 * #400 shipped a then-vs-now comparison, but per movement, and only for the six
 * that span both stretches — leaving 42 archive movements with no comparative
 * surface and no way to ask the more interesting question: not "is my bench
 * better", but "what did training look like then versus now".
 *
 * The answer is mostly that it changed in *kind*. A barbell gym rotation became
 * bodyweight grease-the-groove, which is why this page states each era on its
 * own terms and never subtracts one from the other. There is deliberately no
 * headline figure: over a dataset this heterogeneous, a single percentage would
 * be invented precision.
 *
 * A leaf page like the per-exercise and per-template views — no sub-nav pill of
 * its own, reached from History.
 */
export default async function WeightRoomErasPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const [query, data, realExercises, isAdmin] = await Promise.all([
    searchParams,
    getWeightRoomDataServer().catch(() => null),
    getWeightRoomExercisesServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  const realSets = data?.sets ?? []
  // Same contract as every other Weight Room surface: the fixture stands in
  // only when the real read is empty.
  const isPreviewMode = realSets.length === 0 && isPreviewDemoActive(query.preview)
  const grooveDemo = isPreviewMode ? buildWeightRoomDemoData() : null
  const workoutDemo = isPreviewMode ? buildWorkoutDemoData() : null

  const sets = isPreviewMode
    ? [...(grooveDemo?.sets ?? []), ...(workoutDemo?.sets ?? [])]
    : realSets
  const exercises = workoutDemo?.exercises ?? data?.exercises ?? realExercises

  const eras = buildLogEras(sets, exercises)
  const exerciseLabels = buildExerciseLabels(exercises)

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
            Two eras
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            The whole log, either side of the layoff — what the training was, not just how much of
            it there was. The kind of work changed more than the amount did, so nothing here
            averages one era against the other.
          </p>
          <WeightRoomSubNav active="history" className="mt-5" isAdmin={isAdmin} />
        </header>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="This history is illustrative — not Lucas’s real training log." />
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-8 pb-16">
          {eras === null ? (
            <p
              data-testid="era-empty"
              className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
            >
              This view needs two stretches of training separated by a long layoff. The log is one
              continuous run so far — there is no “then” to compare against, and drawing a boundary
              anyway would invent the comparison.
            </p>
          ) : (
            <>
              <EraContrastPanel eras={eras} exerciseLabels={exerciseLabels} />
              <EraCadenceChart months={eras.months} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
