import { Suspense, type JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { CombineDataIsland } from '@/components/training-facility/combine/CombineDataIsland'
import { JumpTrackerSection } from '@/components/training-facility/combine/JumpTrackerSection'
import { CombineScene } from '@/components/training-facility/scenes/CombineScene'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Combine sub-area page (PRD §7.5 + §9, #197). Hero is the illustrated
 * room rendered full-bleed in the first viewport with floating chrome
 * on top — same "art IS page" treatment as the Gym and Weight Room.
 * Scroll past the scene reveals the data islands:
 * - {@link CombineDataIsland}: scoreboard summary header (PRD §9.1),
 *   Trading Card stat block (PRD §9.2), four-axis Radar (PRD §9.7),
 *   dev-only entry form (PRD §7.5 view 7), and benchmark history table
 *   (PRD §7.5 view 8 + §7.11 CRUD).
 * - {@link JumpTrackerSection}: silhouette + ceiling-view pair (PRD
 *   §9.3 / §9.4).
 *
 * Gated behind {@link isTrainingFacilityEnabled} so the route stays
 * 404'd in production until the Training Facility ships publicly. The
 * page itself is a server component for the flag check; the islands
 * are client components so the data layer's relative-URL fetch can run
 * after hydration.
 *
 * @throws calls Next.js `notFound()` (which throws) when the
 *   `NEXT_PUBLIC_ENABLE_TRAINING_FACILITY` flag is false, so the route
 *   renders 404 on the public site until the flag flips.
 */
export default function TrainingFacilityCombinePage(): JSX.Element {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <div className="relative min-h-svh w-full overflow-x-hidden bg-[#0e0a08] text-[#f7ead9]">
      {/* Visually-hidden h1 — accessibility heading + e2e anchor so the
          page still has a named identity for screen readers / Playwright
          even though the scene-first layout has no visible title. */}
      <h1 className="sr-only">The Combine</h1>
      {/* Hero scene — fills the first viewport; scroll past for data. */}
      <div className="relative h-svh w-full overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <CombineScene />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="pointer-events-auto absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6 lg:p-8">
            <BackToCourtButton />
            <Link
              href="/training-facility"
              className="rounded-full border border-white/15 bg-[#0e0a08]/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 backdrop-blur transition hover:bg-[#0e0a08]/95"
            >
              ← Training Facility
            </Link>
          </div>
        </div>
      </div>

      {/* Data islands below — visitor-facing visualizations (PRD §9). */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <Suspense fallback={null}>
          <CombineDataIsland />
        </Suspense>

        <Suspense fallback={null}>
          <JumpTrackerSection />
        </Suspense>
      </div>
    </div>
  )
}
