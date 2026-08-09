import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { ProgramPanel } from '@/components/training-facility/weight-room/ProgramPanel'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isAdminRequest } from '@/lib/auth/admin-session'
import {
  getWeightRoomWorkoutsServer,
  getWorkoutTemplatesServer,
} from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { buildProgramSummary } from '@/lib/training-facility/training-program'

/**
 * The training programme (#436) — which template ran when, and how well the
 * rotation held.
 *
 * A different altitude from every other Weight Room surface: not one session,
 * not one movement, but the *plan* behind sixteen months of them. It only
 * became answerable with #400, which imported 133 templated sessions from the
 * Apple Notes archive.
 *
 * Deliberately says nothing about the current era. Today's training is
 * grease-the-groove with no template at all, so there is no rotation to report
 * — and the page says that outright rather than drawing an empty one.
 *
 * Public and read-only, like the rest of the room.
 */
export default async function WeightRoomProgramPage(): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const [workouts, templates, isAdmin] = await Promise.all([
    getWeightRoomWorkoutsServer().catch(() => []),
    getWorkoutTemplatesServer().catch(() => []),
    isAdminRequest().catch(() => false),
  ])

  const summary = buildProgramSummary(workouts, templates)

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
            Weight Room · Program
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            The Rotation
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Six templates on a cycle, run across sixteen months and written down one note per
            session. This is the programme those notes describe — how often it ran, how strictly the
            order held, and how long each kind of day actually took.
          </p>
          <WeightRoomSubNav active="program" className="mt-5" isAdmin={isAdmin} />
        </header>

        <div className="mt-8 pb-16">
          {summary === null ? (
            <p
              data-testid="program-empty"
              className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
            >
              No session names a template yet. Current training is logged set by set rather than
              against a programme, so there is no rotation to describe.
            </p>
          ) : (
            <ProgramPanel summary={summary} />
          )}
        </div>
      </div>
    </div>
  )
}
