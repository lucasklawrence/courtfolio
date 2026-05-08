import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { StrengthSettings } from '@/components/training-facility/weight-room/StrengthSettings'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { getWeightRoomDataServer } from '@/lib/data/weight-room-server'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Weight Room settings page (#79). Admin-only — non-admins get a 404
 * via `notFound()` so the route doesn't even hint at its existence to
 * unauthenticated viewers.
 *
 * Server Component because the admin check has to run server-side
 * (`ADMIN_EMAILS` is intentionally not a `NEXT_PUBLIC_*` var, so the
 * allowlist never reaches the browser bundle). The actual editor UI is
 * a client component that posts to the admin API routes — see
 * {@link StrengthSettings}.
 *
 * Goals are read server-side and passed to the client island so the
 * form hydrates with current values; the client refreshes via
 * `router.refresh()` after each mutation to pick up the new state.
 */
export default async function WeightRoomSettingsPage(): Promise<JSX.Element> {
  if (!isTrainingFacilityEnabled()) notFound()
  await requireAdminPage()

  // Catch transient read errors so a flaky Supabase response surfaces
  // as an empty editor instead of 500ing the whole page. The Settings
  // UI handles `goals: []` gracefully (renders the add-exercise form
  // without an existing-goal table).
  const data = await getWeightRoomDataServer().catch(() => null)
  const goals = data?.goals ?? []

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.16),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
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
            Weight Room · Settings
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Goals &amp; exercises
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Daily targets and display colors for the activity rings and
            heatmap. Add new exercises here — the rings populate live as
            soon as you log a set.
          </p>
          <WeightRoomSubNav active="settings" className="mt-5" />
        </header>

        <section className="mt-10">
          <StrengthSettings initialGoals={goals} />
        </section>
      </div>
    </div>
  )
}
