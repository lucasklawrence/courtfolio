import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { StrengthHeatmap } from '@/components/training-facility/weight-room/StrengthHeatmap'
import { StrengthStats } from '@/components/training-facility/weight-room/StrengthStats'
import { WeeklyVolumeChart } from '@/components/training-facility/weight-room/WeeklyVolumeChart'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { getWeightRoomDataServer } from '@/lib/data/weight-room-server'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { computeStrengthStats } from '@/lib/training-facility/weight-room-history'
import type { ExerciseGoal } from '@/types/weight-room'

/**
 * Weight Room History page (#81). Public route — anyone can read the
 * heatmap and stats; admin gating only applies to writes (the Settings
 * page and the admin API). Renders one heatmap per configured exercise
 * stacked vertically, with the per-exercise stats panel underneath.
 *
 * Server Component because the data read is server-side via the
 * SSR Supabase client; the heatmap and stats are pure visual children
 * that don't need any interactivity to fulfill the issue's "Done when".
 *
 * Empty-state behavior: when `getWeightRoomDataServer()` returns
 * `null` (no sets and no goals — pre-migration / fully cleared) the
 * page renders the page chrome with a copy that points the admin at
 * Settings. When sets exist but for a deleted exercise, those sets are
 * silently dropped from the per-exercise heatmaps because we render
 * one heatmap per *goal*, not per encountered exercise — matching how
 * the Settings page treats goals as the source of truth.
 */
export default async function WeightRoomHistoryPage(): Promise<JSX.Element> {
  if (!isTrainingFacilityEnabled()) notFound()

  // Catch transient read errors so a flaky Supabase response surfaces
  // as the empty-state copy rather than 500ing the whole page. Mirrors
  // the same .catch() in the Settings page.
  const data = await getWeightRoomDataServer().catch(() => null)
  const goals: readonly ExerciseGoal[] = data?.goals ?? []
  const sets = data?.sets ?? []
  const stats = computeStrengthStats(sets, goals)

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
            Weight Room · History
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Heatmap &amp; stats
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            One row per day for the trailing 52 weeks, colored by how close that day got to the
            daily goal. Hover any cell for the day&rsquo;s breakdown. Stats below summarize the
            current week, month, and all-time totals.
          </p>
          <WeightRoomSubNav active="history" className="mt-5" />
        </header>

        {goals.length === 0 ? (
          <section
            data-testid="weight-room-history-empty"
            className="mt-10 rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-sm text-[#e8d5be]"
          >
            <p>No exercises configured yet.</p>
            <p className="mt-2 text-[#e8d5be]/70">
              Add one in{' '}
              <Link
                href="/training-facility/weight-room/settings"
                className="underline decoration-dotted underline-offset-4 hover:text-amber-200"
              >
                Settings
              </Link>{' '}
              to start tracking history.
            </p>
          </section>
        ) : (
          <>
            <section
              aria-label="Per-exercise heatmaps"
              data-testid="weight-room-heatmaps"
              className="mt-10 space-y-8"
            >
              {goals.map(goal => (
                <article
                  key={goal.exercise}
                  className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5"
                >
                  <header className="mb-4 flex items-baseline justify-between gap-3">
                    <h2
                      className="font-mono text-sm font-bold uppercase tracking-[0.2em]"
                      style={{ color: goal.color }}
                    >
                      {goal.exercise}
                    </h2>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">
                      goal {goal.daily_target}/day
                    </span>
                  </header>
                  <div className="overflow-x-auto">
                    <StrengthHeatmap sets={sets} goal={goal} />
                  </div>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">
                      Weekly volume · last 12 weeks
                    </p>
                    <div className="overflow-x-auto">
                      <WeeklyVolumeChart sets={sets} goal={goal} />
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="mt-10">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
                Stats
              </h2>
              <div className="mt-4">
                <StrengthStats stats={stats} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
