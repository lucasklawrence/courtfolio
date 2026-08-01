import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { TrophyRoom } from '@/components/training-facility/weight-room/TrophyRoom'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isAdminRequest } from '@/lib/auth/admin-session'
import {
  getWeightRoomAchievementsServer,
  getWeightRoomDataServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { buildTrophyRoomView } from '@/lib/training-facility/achievements'

/**
 * Weight Room Trophy Room (#336) — the "grease the groove" achievement wall.
 *
 * Public route, mirroring History: anyone can read the wall; admin gating only
 * applies to writes (editing the ladder happens on the Settings page). Server
 * Component because the badge resolution is a pure function of two server-side
 * reads — nothing here needs interactivity, so no badge math ships to the
 * browser.
 *
 * Both reads are wrapped in `.catch()` so a flaky Supabase response degrades to
 * the empty state rather than 500ing the page — the same treatment the History
 * and Settings pages give their reads. An empty ladder is a valid steady state
 * (no tiers configured yet), which {@link TrophyRoom} renders as its own
 * empty-state copy.
 */
export default async function WeightRoomAchievementsPage(): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  // `isAdmin` is resolved here rather than by the sub-nav so this page ships
  // no browser Supabase client — see WeightRoomSubNavProps.isAdmin (#345).
  const [data, achievements, isAdmin] = await Promise.all([
    getWeightRoomDataServer().catch(() => null),
    getWeightRoomAchievementsServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  const view = buildTrophyRoomView(
    data?.sets ?? [],
    data?.goals ?? [],
    achievements,
    data?.exercises ?? []
  )

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.14),transparent_32%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <FacilityBackLink />
        </div>

        <header className="mt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Weight Room · Trophy Room
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            The trophy room
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Every banner here got hung with reps, not talk. Hundred-rep days, four-figure weeks,
            streaks that survived a Tuesday &mdash; earned off the same set log that fills the
            rings. Nothing is stored: the wall is recomputed from scratch every visit.
          </p>
          <WeightRoomSubNav active="achievements" className="mt-5" isAdmin={isAdmin} />
        </header>

        <div className="mt-10 pb-16">
          <TrophyRoom view={view} />
        </div>
      </div>
    </div>
  )
}
