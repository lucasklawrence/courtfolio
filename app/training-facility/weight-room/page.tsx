import { Suspense, type JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LazyMount } from '@/components/common/LazyMount'
import { WeightRoomScene } from '@/components/training-facility/scenes/WeightRoomScene'
import { TodayDataIsland } from '@/components/training-facility/weight-room/TodayDataIsland'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Weight Room sub-area landing page (#80 — Today View). The activity
 * rings + quick-log + today's-set list are the centerpiece; admin
 * viewers get the log form, everyone sees the rings.
 *
 * Server Component for the flag gate + chrome only — the data island
 * is a Client Component because it needs `useSearchParams()` for the
 * empty-state preview affordance and `getWeightRoomData()` reads
 * Supabase via the browser client.
 *
 * Cross-view nav between Today / History / Settings lives in the
 * shared {@link WeightRoomSubNav} pill row beneath the header — added
 * by slice #82.
 */
export default function TrainingFacilityWeightRoomPage(): JSX.Element {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.16),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
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
            Training Facility / Weight Room
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl lg:text-6xl">
            Today
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:mx-0 sm:text-base">
            Grease-the-groove pushups and pullups. The rings track today’s
            progress against the daily targets; tap a chip to log a set.
          </p>
          <WeightRoomSubNav active="today" className="mt-5 justify-center sm:justify-start" />
        </header>

        {/* Suspense required because the island reads `useSearchParams()`
            for the `?preview=demo` empty-state affordance. The fallback
            is null because the island owns its own loading skeleton. */}
        <Suspense fallback={null}>
          <TodayDataIsland />
        </Suspense>

        {/* Decorative scene illustration — same framed-card pattern as
            `/training-facility/gym` and `/training-facility/combine`. The
            rings + log form remain the centerpiece; the scene below
            anchors the page as a "room."

            Wrapped in `LazyMount` so the multi-MB illustrated SVGs
            (BenchPress, SquatRack, etc.) aren't fetched on first paint —
            the rings + log form above the fold get full bandwidth, and
            the scene fetches as the user scrolls toward it. */}
        <LazyMount
          rootMargin="400px"
          minHeight={420}
          className="mx-auto w-full max-w-6xl rounded-[1.6rem] border border-white/10 bg-black/35 p-3 shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:p-5"
        >
          <WeightRoomScene />
        </LazyMount>
      </div>
    </div>
  )
}
