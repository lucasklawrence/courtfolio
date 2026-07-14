import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { OtfMileageAwardsSettings } from '@/components/training-facility/gym/OtfMileageAwardsSettings'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { getOtfMileageAwardsServer } from '@/lib/data/otf-server'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * OrangeTheory mileage-milestone settings page (#321). Admin-only — non-admins
 * get a 404 via `notFound()` so the route doesn't hint at its existence to
 * unauthenticated viewers.
 *
 * Server Component because the admin check has to run server-side
 * (`ADMIN_EMAILS` is intentionally not a `NEXT_PUBLIC_*` var, so the allowlist
 * never reaches the browser bundle). The editor UI is a client island that
 * posts to the admin API routes — see {@link OtfMileageAwardsSettings}.
 *
 * The milestone ladder is read server-side and passed to the island so the
 * form hydrates with current values; the island refreshes via
 * `router.refresh()` after each mutation to pick up the new state.
 */
export default async function OtfMileageSettingsPage(): Promise<JSX.Element> {
  if (!isTrainingFacilityEnabled()) notFound()
  await requireAdminPage()

  // Catch transient read errors so a flaky Supabase response surfaces as an
  // empty editor instead of 500ing the page. The island handles `awards: []`
  // gracefully (renders the add form without an existing-tier list).
  const awards = await getOtfMileageAwardsServer().catch(() => [])

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <Link
            href="/training-facility/gym/otf"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← OrangeTheory
          </Link>
        </div>

        <header className="mt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#f97316]">
            OrangeTheory · Settings
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Mileage milestones
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Distance thresholds that light up a badge as each month&apos;s OTF
            miles (treadmill + rower) add up. Edit a tier&apos;s distance and the
            badges re-light instantly — nothing is stored per month.
          </p>
        </header>

        <section className="mt-10">
          <OtfMileageAwardsSettings initialAwards={awards} />
        </section>
      </div>
    </div>
  )
}
