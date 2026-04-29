import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { GymScene } from '@/components/training-facility/scenes/GymScene'
import { getCardioData } from '@/lib/data/cardio'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * `/training-facility/gym` route — the cardio sub-area scene.
 *
 * Server-fetches `cardio.json` so the wall fixtures (HR monitor, VO2max
 * whiteboard, wall scoreboard — PRD §7.4) hydrate with live data on the
 * first paint. Before any Apple Health import has landed the data load
 * returns `null` and the fixtures fall back to painted placeholder
 * values. Gated behind the same Training Facility flag as the parent
 * shell so the route family stays in sync.
 */
export default async function TrainingFacilityGymPage() {
  if (!isTrainingFacilityEnabled()) notFound()
  // Catch transient fetch errors so a flaky data load doesn't 500 the
  // whole page — the fixtures gracefully fall back to placeholders.
  const cardioData = await getCardioData().catch(() => null)

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.16),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← Back to Training Facility
          </Link>
        </div>

        <div className="mt-8 text-center sm:mt-12">
          <div className="inline-flex rounded-full border border-amber-100/25 bg-[#2b1a13]/80 px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.42em] text-amber-100/85 sm:text-xs">
            Cardio wing
          </div>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-[#fff6ea] sm:text-5xl lg:text-6xl">
            The Gym
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#e8d5be] sm:text-base sm:leading-7">
            Stair climber dead center, treadmill on the left, indoor track
            curving along the back wall. Tap a piece of equipment in a later
            phase — for now, walk through the back door to The Combine.
          </p>
        </div>

        <div className="mt-8 flex-1 sm:mt-10">
          <div className="mx-auto w-full max-w-6xl rounded-[1.6rem] border border-white/10 bg-black/35 p-3 shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:p-5">
            <GymScene cardioData={cardioData} />
          </div>
        </div>
      </div>
    </div>
  )
}
