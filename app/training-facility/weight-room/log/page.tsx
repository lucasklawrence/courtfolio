import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LogDataIsland } from '@/components/training-facility/weight-room/LogDataIsland'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Weight Room Log page (#197). Admin-only owner-facing surface where
 * Lucas logs sets, deletes mistakes, and watches today's rings fill
 * live. Sibling to `/training-facility/weight-room/settings` — same
 * `requireAdminPage()` gate (404 for non-admins so the route doesn't
 * even hint at its existence).
 *
 * Separation rationale (#197 design call): the Today view at the
 * sibling route renders the scene full-bleed and is fully read-only;
 * data entry has its own plain-dashboard route here so the form doesn't
 * have to compete with the illustration's aesthetic.
 *
 * Data island fetches client-side so the rings + set list refresh
 * after each mutation without a router refresh round-trip.
 */
export default async function WeightRoomLogPage(): Promise<JSX.Element> {
  if (!isTrainingFacilityEnabled()) notFound()
  await requireAdminPage()

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.16),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← Training Facility
          </Link>
        </div>

        <header className="mt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Weight Room · Log
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Log a set
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Today’s sets, rings, and streaks — plus the form to add a new
            one. The Today view is read-only for visitors; data entry
            lives here.
          </p>
          <WeightRoomSubNav active="log" className="mt-5" />
        </header>

        <section className="mt-10 flex-1">
          <LogDataIsland />
        </section>
      </div>
    </div>
  )
}
