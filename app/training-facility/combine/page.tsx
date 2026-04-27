import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { CombineScene } from '@/components/training-facility/scenes/CombineScene'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

import { CombineScoreboardSection } from './CombineScoreboardSection'

/**
 * Combine sub-area page (PRD §7.5 + §9). Stacks the room-level chrome
 * (back-to-court + back-to-Training-Facility nav), an eyebrow/title block,
 * the scoreboard summary header (PRD §9.1), and the side-on Combine scene
 * SVG. Richer visualizations (Trading Card, Silhouette, Shuttle Trace,
 * Sprint Race, Radar) land in subsequent issues.
 *
 * Gated behind {@link isTrainingFacilityEnabled} so the route stays 404'd
 * in production until the Training Facility ships publicly. The page
 * itself is a server component for the flag check; the scoreboard lives
 * in a client island so the data layer's relative-URL fetch can run after
 * hydration.
 */
export default function TrainingFacilityCombinePage(): JSX.Element {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#0e0a08] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(253,224,71,0.12),transparent_30%),linear-gradient(180deg,#1f1612_0%,#0e0a08_55%,#070504_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← Training Facility
          </Link>
        </div>

        <header className="text-center sm:text-left">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Training Facility / Combine
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl lg:text-6xl">
            The Combine
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:mx-0 sm:text-base">
            Tier-1 movement benchmarks: bodyweight, 5-10-5 shuttle, vertical
            jump, and 10-yard sprint. The scoreboard tracks the latest values
            against the first-ever entry per metric.
          </p>
        </header>

        <CombineScoreboardSection />

        <div className="mx-auto w-full max-w-6xl rounded-[1.6rem] border border-white/10 bg-black/35 p-3 shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:p-5">
          <CombineScene />
        </div>
      </div>
    </div>
  )
}
