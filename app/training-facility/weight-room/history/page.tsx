import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { ExerciseFilterChips } from '@/components/training-facility/weight-room/ExerciseFilterChips'
import { exerciseTrendHref } from '@/components/training-facility/weight-room/ExerciseProgressionPanel'
import { FocusLaneHeatmap } from '@/components/training-facility/weight-room/FocusLaneHeatmap'
import { LoadManagementPanel } from '@/components/training-facility/weight-room/LoadManagementPanel'
import { PastFocusCard } from '@/components/training-facility/weight-room/PastFocusCard'
import { StrengthHeatmap } from '@/components/training-facility/weight-room/StrengthHeatmap'
import { ExerciseStatCard } from '@/components/training-facility/weight-room/StrengthStats'
import { StrengthVsBodyweightChart } from '@/components/training-facility/weight-room/StrengthVsBodyweightChart'
import { VariantBreakdown } from '@/components/training-facility/weight-room/VariantBreakdown'
import { WeeklyVolumeChart } from '@/components/training-facility/weight-room/WeeklyVolumeChart'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { buildWeightRoomDemoData } from '@/constants/weight-room-demo-fixture'
import { isAdminRequest } from '@/lib/auth/admin-session'
import { getCardioDataServer } from '@/lib/data/cardio-server'
import { getWeightRoomDataServer } from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import {
  EXERCISE_FILTER_PARAM,
  parseExerciseSelection,
} from '@/lib/training-facility/exercise-filter'
import { pacificDayKey } from '@/lib/training-facility/day-keys'
import { exerciseLabel } from '@/lib/training-facility/exercise-labels'
import { buildMovementLoadView } from '@/lib/training-facility/load-management'
import {
  TRAINING_FACILITY_PREVIEW_PARAM,
  isPreviewDemoActive,
} from '@/lib/training-facility/preview-param'
import {
  buildFocusLaneCells,
  computeFocusAdherence,
  computeFocusLoadStats,
  type FocusDayCell,
} from '@/lib/training-facility/monthly-focus'
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
/** Route the filter chips link back to. */
const HISTORY_PATH = '/training-facility/weight-room/history'

/**
 * Query params the filter chips must preserve when toggling. Only the
 * Training-Facility preview flag today — an allowlist rather than a
 * pass-through so a chip href can't be turned into an open redirect vector by
 * an arbitrary param riding along.
 */
const CARRIED_PARAMS = [TRAINING_FACILITY_PREVIEW_PARAM] as const

export default async function WeightRoomHistoryPage({
  searchParams,
}: {
  /** Next 15 passes search params as a promise. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  const params = await searchParams

  // Catch transient read errors so a flaky Supabase response surfaces
  // as the empty-state copy rather than 500ing the whole page. Mirrors
  // the same .catch() in the Settings page. The cardio read (for the
  // bodyweight overlay) runs alongside and degrades independently — a
  // failed/empty cardio fetch just drops the relative-strength section.
  // `isAdmin` is resolved here rather than by the sub-nav so this page ships
  // no browser Supabase client — see WeightRoomSubNavProps.isAdmin (#345).
  const [realData, cardio, isAdmin] = await Promise.all([
    getWeightRoomDataServer().catch(() => null),
    getCardioDataServer().catch(() => null),
    isAdminRequest().catch(() => false),
  ])

  // `?preview=demo` substitutes the sample dataset when there's nothing real
  // to show — same opt-in the Gym and Weight Room scenes already honour
  // (#162 / #171), extended here so the charts have something to draw (#359).
  //
  // It is what makes this page's rendering testable in CI: the e2e job has no
  // Supabase credentials, so without a fixture every chart renders empty and a
  // browser-level assertion about chart layout would pass by finding nothing.
  // Gated on the real data being empty, so a populated deploy ignores the
  // param entirely.
  const realIsEmpty = realData === null || realData.sets.length === 0
  const isPreviewMode = realIsEmpty && isPreviewDemoActive(params[TRAINING_FACILITY_PREVIEW_PARAM])
  const data = isPreviewMode ? buildWeightRoomDemoData() : realData

  const goals: readonly ExerciseGoal[] = data?.goals ?? []
  const sets = data?.sets ?? []
  const focuses = data?.monthly_focus ?? []

  // Separate permanent heatmap goals from focus anchors (#361). Focus
  // anchors are time-boxed campaigns whose window closes; keeping them in
  // the per-exercise heatmap loop produces a "graveyard" of mostly-empty
  // year-long charts once a rotation ends. The dedicated GTG section below
  // shows their history instead.
  const permanentGoals = goals.filter(g => g.kind !== 'focus')

  // Stats cover *every* exercise including focus anchors (#367). The heatmap
  // exclusion above is about empty year-long grids, which the stats panel
  // doesn't have — leaving focuses out of it only hid their streaks and
  // totals for no benefit. Passing `focuses` scores their days against the
  // rotation's target rather than the anchor's scalar.
  const stats = computeStrengthStats(sets, goals, new Date(), focuses)

  // Filtering happens here, on the server (#367). The route is dynamic
  // already — `isAdminRequest()` reads cookies — so resolving the selection
  // from the URL costs nothing and means a *linked* filtered view paints
  // correctly on first byte, with no flash of everything before narrowing and
  // no dependence on JS having loaded.
  const filterable = goals.map(g => g.exercise)
  const selectedExercises = parseExerciseSelection(params[EXERCISE_FILTER_PARAM], filterable)
  const selectedSet = new Set(selectedExercises)
  const visibleGoals = permanentGoals.filter(g => selectedSet.has(g.exercise))
  const visibleStats = stats.filter(s => selectedSet.has(s.exercise))

  const carryParams: Record<string, string> = {}
  for (const key of CARRIED_PARAMS) {
    const raw = params[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (typeof value === 'string' && value !== '') carryParams[key] = value
  }
  // The catalog classifies each movement as load- or rep-driven from its
  // equipment (#384); without it the panel falls back to guessing from the
  // share of weighted sets.
  // Movements trained on fewer than a few days a fortnight are held back rather
  // than carded (#377) — see MIN_TRAINING_DAYS_IN_WINDOW for why a once-a-week
  // gym lift's ACWR is noise.
  const { loads, infrequent } = buildMovementLoadView(sets, goals, undefined, data?.exercises ?? [])
  const bodyMass = cardio?.body_mass_trend ?? []

  // The relative-strength overlay is featured for pull-ups specifically —
  // the most bodyweight-sensitive movement, where reps up + weight down
  // is the clearest "improving on two fronts" story. Only render it when
  // both halves exist: a configured pull-ups goal and bodyweight data.
  const pullupsGoal = permanentGoals.find(g => g.exercise.toLowerCase() === 'pullups')

  // GTG rotation: sort newest-first so the latest campaign leads (#361).
  const sortedFocuses = [...focuses].sort((a, b) => b.start_date.localeCompare(a.start_date))

  // Combined lane heatmaps — one series per body-region spanning all
  // focus windows stitched together. Built once server-side so the SVG
  // renderer receives a flat cells array.
  const today = pacificDayKey(new Date())
  const upperCells = buildFocusLaneCells(focuses, sets, 'upper', today)
  const lowerCells = buildFocusLaneCells(focuses, sets, 'lower', today)

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
            Weight Room · History
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Heatmap &amp; stats
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Per-exercise heatmaps, grease-the-groove rotation history, and all-time stats. Each
            heatmap cell represents one day colored by adherence to the daily goal — hover for the
            breakdown. GTG focuses are shown as a stitched timeline so each rotation&rsquo;s
            exercise lines up with its own window.
          </p>
          <WeightRoomSubNav active="history" className="mt-5" isAdmin={isAdmin} />
        </header>

        {/* Sample data must never read as a real log. Same treatment the
            Combine and cardio surfaces already use for their preview branch
            (#160 / #162) — a visible chip plus an exit affordance, rather than
            demo heatmaps and stats that look exactly like populated ones. */}
        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="These heatmaps and stats are illustrative — not Lucas’s real training log." />
          </div>
        ) : null}

        {permanentGoals.length === 0 && focuses.length === 0 ? (
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
            <section className="mt-10">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
                Load Management
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-[#e8d5be]">
                Ramp rate per movement, bucketed in Pacific time. The injury driver for tendon is
                how fast weekly volume climbs, not its absolute size &mdash; a{' '}
                <abbr title="week-over-week">WoW</abbr> jump past +10% or an{' '}
                <abbr title="acute:chronic workload ratio — acute 7-day volume over the 28-day weekly baseline">
                  ACWR
                </abbr>{' '}
                over 1.3 flags for a closer look.
              </p>
              <div className="mt-4">
                <LoadManagementPanel loads={loads} infrequent={infrequent} />
              </div>
            </section>

            {sortedFocuses.length > 0 && (
              <section
                aria-label="Grease the Groove rotation"
                data-testid="weight-room-gtg-rotation"
                className="mt-10"
              >
                <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
                  Grease the Groove Rotation
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[#e8d5be]">
                  Each time-boxed focus in the rotation, newest first. The ring shows overall
                  adherence — how many days in the window hit the daily target. Weighted focuses
                  also show top set, average load, and cumulative tonnage.
                </p>
                <div className="mt-4 space-y-3">
                  {sortedFocuses.map(focus => (
                    <PastFocusCard
                      key={focus.id}
                      focus={focus}
                      adherence={computeFocusAdherence(focus, sets)}
                      loadStats={computeFocusLoadStats(
                        focus,
                        sets,
                        goals.find(g => g.exercise === focus.exercise)?.load_multiplier ?? 1
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            <ExerciseFilterChips
              exercises={goals.map(goal => ({
                exercise: goal.exercise,
                displayName: goal.display_name,
                color: goal.color,
                isFocus: goal.kind === 'focus',
              }))}
              selected={selectedExercises}
              pathname={HISTORY_PATH}
              carryParams={carryParams}
            />

            {visibleGoals.length > 0 ? (
              <section
                aria-label="Per-exercise heatmaps"
                data-testid="weight-room-heatmaps"
                className="mt-10 space-y-8"
              >
                {visibleGoals.map(goal => (
                  <article
                    key={goal.exercise}
                    className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5"
                  >
                    <header className="mb-4 flex items-baseline justify-between gap-3">
                      <h2
                        className="font-mono text-sm font-bold uppercase tracking-[0.2em]"
                        style={{ color: goal.color }}
                      >
                        {exerciseLabel(goal)}
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
                    {/* Renders only once this exercise has grip-tagged sets
                        (#254); otherwise it's null and the article ends at
                        the volume chart. */}
                    <VariantBreakdown sets={sets} goal={goal} />
                  </article>
                ))}
              </section>
            ) : (
              <p
                data-testid="exercise-filter-empty"
                className="mt-10 rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
              >
                No exercises selected — pick one above to see its heatmap and stats.
              </p>
            )}

            {pullupsGoal && bodyMass.length > 0 && (
              <section className="mt-10">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
                  Relative strength
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[#e8d5be]">
                  Weekly pull-up volume (completed weeks) against morning bodyweight. Reps climbing
                  while weight falls is improvement on two fronts at once.
                </p>
                <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/5 p-5">
                  <div className="overflow-x-auto">
                    <StrengthVsBodyweightChart sets={sets} goal={pullupsGoal} bodyMass={bodyMass} />
                  </div>
                </div>
              </section>
            )}

            {visibleStats.length > 0 && (
              <section className="mt-10">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
                  Stats
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {visibleStats.map(stat => (
                    // Each card's heading opens that movement's own trend
                    // (#412), carrying the preview flag so a demo tour stays in
                    // the demo.
                    <ExerciseStatCard
                      key={stat.exercise}
                      stat={stat}
                      href={exerciseTrendHref(stat.exercise, isPreviewMode)}
                    />
                  ))}
                </div>
              </section>
            )}

            {(upperCells.length > 0 || lowerCells.length > 0) && (
              <section
                aria-label="Combined focus-lane heatmaps"
                data-testid="weight-room-focus-lanes"
                className="mt-10"
              >
                <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
                  Focus Lane History
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[#e8d5be]">
                  A stitched heatmap for each body region that has a rotation on file. Each day is
                  colored by how close it came to the active focus&rsquo;s daily target, and every
                  rotation keeps its own color — so when the focus changes, the next exercise picks
                  up on the same timeline. Faint cells are days between rotations.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {upperCells.length > 0 && <FocusLaneCard cells={upperCells} title="Upper" />}
                  {lowerCells.length > 0 && <FocusLaneCard cells={lowerCells} title="Lower" />}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Props for {@link FocusLaneCard}. */
interface FocusLaneCardProps {
  /** Ordered lane cells from `buildFocusLaneCells`, one body region's worth. */
  cells: FocusDayCell[]
  /** Body-region name shown as the card header, e.g. `"Upper"`. */
  title: string
}

/**
 * One body region's lane heatmap in its own card.
 *
 * Half-width from `md` up so a lane covering a few weeks sits in a
 * container it can plausibly fill, rather than a full-width card it leaves
 * ~87% empty (#370). The header is what tells the two lanes apart once
 * both are configured — the region name previously lived only in the SVG's
 * `aria-label`, invisible to sighted readers.
 */
function FocusLaneCard({ cells, title }: FocusLaneCardProps): JSX.Element {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#e8d5be]/70">
        {title}
      </h3>
      {/* Scrolls rather than squashing once the rotation history outgrows
          the card — the same treatment the per-exercise heatmaps get. */}
      <div className="mt-3 overflow-x-auto">
        <FocusLaneHeatmap cells={cells} label={`${title} Focus Lane`} />
      </div>
    </div>
  )
}
