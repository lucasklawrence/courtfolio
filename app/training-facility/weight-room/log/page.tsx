import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { LogDataIsland } from '@/components/training-facility/weight-room/LogDataIsland'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { getWorkoutTemplatesServer } from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'

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
  if (!isWeightRoomEnabled()) notFound()
  await requireAdminPage()

  // Templates are read server-side and handed down (#376) so the live panel
  // doesn't add a client round trip on mount. A read failure degrades to
  // "freestyle only" rather than failing the page — you can still start a
  // workout and log into it without a prescription.
  const templates = await getWorkoutTemplatesServer().catch(() => [])

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
            Weight Room · Log
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Log a set
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Today’s sets, rings, and streaks — plus the form to add a new one. The Today view is
            read-only for visitors; data entry lives here.
          </p>
          <WeightRoomSubNav active="log" className="mt-5" isAdmin />
        </header>

        <section className="mt-10 flex-1">
          <LogDataIsland templates={templates} />
        </section>
      </div>
    </div>
  )
}
