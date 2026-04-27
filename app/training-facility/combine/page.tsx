import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { CombineScene } from '@/components/training-facility/scenes/CombineScene'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * `/training-facility/combine` route — the movement-benchmark sub-area scene.
 *
 * Phase 1: scene-only. Cones, stopwatch, Vertec, and a results board render
 * the staging area; the seven signature visualizations from PRD §9 land in
 * later issues. Gated behind the same Training Facility flag as the parent
 * shell so the route family stays in sync.
 */
export default function TrainingFacilityCombinePage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#0e0a08] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(253,224,71,0.12),transparent_30%),linear-gradient(180deg,#1f1612_0%,#0e0a08_55%,#070504_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← Training Facility
          </Link>
        </div>

        <div className="mt-8 text-center sm:mt-12">
          <div className="inline-flex rounded-full border border-sky-100/25 bg-[#10202b]/80 px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.42em] text-sky-100/85 sm:text-xs">
            Movement wing
          </div>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-[#fff6ea] sm:text-5xl lg:text-6xl">
            The Combine
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#e8d5be] sm:text-base sm:leading-7">
            The staging area for measurables. Cones lined up for the 5-10-5
            shuttle, a Vertec rig against the wall, a stopwatch ticking in the
            middle of the floor.
          </p>
        </div>

        <div className="mt-8 flex-1 sm:mt-10">
          <div className="mx-auto w-full max-w-6xl rounded-[1.6rem] border border-white/10 bg-black/35 p-3 shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:p-5">
            <CombineScene />
          </div>
        </div>
      </div>
    </div>
  )
}
