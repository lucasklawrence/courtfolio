import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LobbyBackLink } from '@/components/training-facility/LobbyBackLink'
import { AchievementSettings } from '@/components/training-facility/weight-room/AchievementSettings'
import { StrengthSettings } from '@/components/training-facility/weight-room/StrengthSettings'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import {
  getWeightRoomAchievementsServer,
  getWeightRoomDataServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'

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
  if (!isWeightRoomEnabled()) notFound()
  await requireAdminPage()

  // Catch transient read errors so a flaky Supabase response surfaces
  // as an empty editor instead of 500ing the whole page. The Settings
  // UI handles `goals: []` gracefully (renders the add-exercise form
  // without an existing-goal table). The achievement ladder read (#336)
  // degrades independently — a failed fetch just empties that editor.
  const [data, achievements] = await Promise.all([
    getWeightRoomDataServer().catch(() => null),
    getWeightRoomAchievementsServer().catch(() => []),
  ])
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
          <LobbyBackLink />
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
          <WeightRoomSubNav active="settings" className="mt-5" isAdmin />
        </header>

        <section className="mt-10">
          <StrengthSettings initialGoals={goals} />
        </section>

        <section className="mt-14 border-t border-white/10 pt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Trophy Room
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[#e8d5be]">
            The achievement ladder behind{' '}
            <Link
              href="/training-facility/weight-room/achievements"
              className="underline decoration-dotted underline-offset-4 hover:text-amber-200"
            >
              the trophy room
            </Link>
            . Nothing is stored as &ldquo;earned&rdquo; &mdash; retune a threshold and the wall
            re-resolves from the whole set log on the next visit.
          </p>
          <div className="mt-6">
            <AchievementSettings initialAchievements={achievements} exercises={goals.map(g => g.exercise)} />
          </div>
        </section>
      </div>
    </div>
  )
}
