'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { CardioData, CardioSession } from '@/types/cardio'
import { getCardioData } from '@/lib/data'
import {
  DateFilter,
  endOfDay,
  rangeForPreset,
  startOfDay,
  type DateRange,
} from '@/components/training-facility/shared/DateFilter'
import {
  aggregateHrZoneSeconds,
  formatDuration,
  parseSessionDate,
} from '@/lib/training-facility/cardio-shared'
import {
  METERS_PER_MILE,
  formatDistanceMiles,
  formatPaceCellFromSecPerKm,
} from '@/lib/training-facility/running'
import {
  ACTIVITY_VISUALS,
  countByActivity,
  filterAllCardioSessions,
  perSessionAvgHrByActivity,
  summarizeAllCardio,
  type ActivityCount,
} from '@/lib/training-facility/all-cardio'
import {
  trainingLoadInRange,
  type TrainingLoadPoint,
} from '@/lib/training-facility/training-load'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { HrZoneBars } from './HrZoneBars'
import { ActivityLegend, AvgHrBarsByActivity } from './AvgHrBarsByActivity'
import { SessionZoneStrip } from './SessionZoneStrip'
import { TrainingLoadChart } from './TrainingLoadChart'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import { defaultMargin } from '@/components/training-facility/shared/charts/types'
import { DEFAULT_MAX_HR } from '@/constants/hr-zones'
import { MaxHrControl } from './MaxHrControl'

const CHART_HEIGHT = 280
const WIDE_CHART_HEIGHT = 300
const MIN_CHART_WIDTH = 280
const DEFAULT_CHART_WIDTH = 560
const DEFAULT_WIDE_WIDTH = 880
const EARLIEST_FALLBACK = new Date(2024, 0, 1)
const FONT_FAMILY = "'Patrick Hand', system-ui, sans-serif"

/**
 * Format a duration in seconds as a compact `Hh MMm` once it crosses an hour,
 * `Mm` below. Used for the stats-wall total/avg cards where hours-of-work is
 * the right granularity (a stair-heavy month is 6h 18m, not 378m).
 */
function formatTotalDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hours}h ${remMins.toString().padStart(2, '0')}m`
}

/** Format a meters value as miles with one decimal — `—` for zero/missing. */
function formatTotalMiles(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—'
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`
}

/**
 * All-cardio overview (PRD §7.4) — the "stats wall" view that aggregates stair,
 * running, and walking sessions into a single page. Sits at
 * `/training-facility/gym/overview` and is the only Gym surface that crosses
 * activity boundaries; the per-equipment detail views (Stair, Treadmill, Track)
 * stay single-activity by design.
 *
 * Composition:
 *   1. Stats summary row — sessions / total time / total distance / avg
 *      duration across all activities in the filtered window.
 *   2. Time-in-zone bars — combined HR-zone seconds across activities.
 *   3. Avg HR per session — bars colored by activity (legend below).
 *   4. Training load — ATL / CTL / TSB. Already pan-activity; lifted up.
 *   5. Activity mix — small breakdown row (sessions + total time per activity).
 *   6. Session log — every session in range with an activity column.
 *
 * Skips the pace and cardiac-efficiency charts — combining walking and running
 * paces on one axis is misleading, and stair sessions don't have pace at all.
 */
export function AllCardioOverview(): JSX.Element {
  const [data, setData] = useState<CardioData | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('1M', EARLIEST_FALLBACK))
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH)
  const [wideWidth, setWideWidth] = useState(DEFAULT_WIDE_WIDTH)
  // Max HR drives the runtime TRIMP formula. Defaults until `MaxHrControl`'s
  // mount-effect reads localStorage; same fallback as before #143 so SSR is
  // unchanged. Shared with the per-equipment detail views via localStorage.
  const [maxHr, setMaxHr] = useState<number>(DEFAULT_MAX_HR)
  const cardSizerRef = useRef<HTMLDivElement>(null)
  const wideSizerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getCardioData()
      .then((next) => {
        if (cancelled) return
        // Same empty-shape substitution as Stair/Treadmill/Track — `null`
        // means a 404 on `cardio.json` (not produced yet, gitignored). Render
        // the empty-state branch instead of sitting on the loading panel.
        setData(
          next ?? {
            imported_at: '',
            sessions: [],
            resting_hr_trend: [],
            vo2max_trend: [],
          },
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err : new Error(String(err)))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const node = cardSizerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(MIN_CHART_WIDTH, Math.floor(entry.contentRect.width))
        setChartWidth((prev) => (prev === next ? prev : next))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = wideSizerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(MIN_CHART_WIDTH, Math.floor(entry.contentRect.width))
        setWideWidth((prev) => (prev === next ? prev : next))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const earliestDate = useMemo(() => {
    if (!data || data.sessions.length === 0) return EARLIEST_FALLBACK
    let earliestMs = Infinity
    for (const s of data.sessions) {
      const ms = parseSessionDate(s.date).getTime()
      if (Number.isFinite(ms) && ms < earliestMs) earliestMs = ms
    }
    return Number.isFinite(earliestMs) ? new Date(earliestMs) : EARLIEST_FALLBACK
  }, [data])

  const sessions = useMemo<CardioSession[]>(
    () => (data ? filterAllCardioSessions(data.sessions, range) : []),
    [data, range],
  )
  const summary = useMemo(() => summarizeAllCardio(sessions), [sessions])
  const buckets = useMemo(() => aggregateHrZoneSeconds(sessions), [sessions])
  const avgHrByActivity = useMemo(() => perSessionAvgHrByActivity(sessions), [sessions])
  const activityCounts = useMemo(() => countByActivity(sessions), [sessions])

  // Training load aggregates ALL cardio activities. Routes through the shared
  // `trainingLoadInRange` helper for the same pre-warm/clip behavior as the
  // per-equipment views, and threads the user's persisted max HR through.
  const trainingLoad = useMemo<TrainingLoadPoint[]>(
    () => (data ? trainingLoadInRange(data.sessions, range, { maxHr }) : []),
    [data, range, maxHr],
  )

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,#241811_0%,#120d0a_52%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackToCourtButton />
          <Link
            href="/training-facility/gym"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← The Gym
          </Link>
        </div>

        <header className="mt-12">
          <div className="text-xs font-semibold uppercase tracking-[0.38em] text-white/60">
            Coach&rsquo;s clipboard
          </div>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em] text-[#fff7ec] sm:text-5xl">
            All cardio — the stats wall
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Stair, run, walk — every cardio session in the window aggregated.
            Time in zone is summed across activities; per-session avg HR is
            color-coded so the activity mix is legible at a glance; training
            load is whole-athlete (ATL / CTL / TSB don&rsquo;t care which
            equipment you used).
          </p>
        </header>

        <div className="mt-8">
          <DateFilter
            earliestDate={earliestDate}
            defaultPreset="1M"
            onChange={setRange}
          />
        </div>

        {loadError ? (
          <ErrorPanel error={loadError} />
        ) : !data ? (
          <LoadingPanel />
        ) : (
          <>
            <SummaryRow summary={summary} />

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Time in zone"
                helper="Total minutes per HR zone, summed across stair, run, and walk."
              >
                <div ref={cardSizerRef}>
                  <HrZoneBars
                    buckets={buckets}
                    width={chartWidth}
                    height={CHART_HEIGHT}
                    fontFamily={FONT_FAMILY}
                  />
                </div>
              </ChartCard>

              <ChartCard
                title="Avg HR per session"
                helper="One bar per session — color is the activity. Legend below."
                footer={<ActivityLegend className="mt-3" />}
              >
                <AvgHrBarsByActivity
                  points={avgHrByActivity}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fontFamily={FONT_FAMILY}
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Training load"
              helper="ATL (acute, 7d) vs. CTL (chronic, 28d) and TSB = CTL − ATL. Whole-athlete metric — every cardio modality contributes."
              wide
              headerSlot={<MaxHrControl onChange={setMaxHr} />}
            >
              <div ref={wideSizerRef}>
                <TrainingLoadChart
                  points={trainingLoad}
                  width={wideWidth}
                  height={WIDE_CHART_HEIGHT}
                  margin={defaultMargin}
                  fontFamily={FONT_FAMILY}
                  axisColor={chartPalette.inkSoft}
                  emptyMessage="No training load in selected range"
                />
              </div>
            </ChartCard>

            <ActivityMix counts={activityCounts} />

            <SessionLogTable sessions={sessions} range={range} />
          </>
        )}
      </div>
    </div>
  )
}

interface SummaryRowProps {
  summary: ReturnType<typeof summarizeAllCardio>
}

/**
 * Stats-wall summary row — four big-number cards that read across the top of
 * the overview. Static (no period comparison) on purpose: this view's job is
 * "what did I do across all activities," not "vs. last month." The per-
 * equipment views are where deltas live (#77).
 */
function SummaryRow({ summary }: SummaryRowProps): JSX.Element {
  const cards: Array<{ key: string; label: string; value: string; unit?: string }> = [
    {
      key: 'sessions',
      label: 'Sessions',
      value: String(summary.sessionCount),
    },
    {
      key: 'time',
      label: 'Total time',
      value: formatTotalDuration(summary.totalDurationSeconds),
    },
    {
      key: 'distance',
      label: 'Total distance',
      value: formatTotalMiles(summary.totalDistanceMeters),
    },
    {
      key: 'avg',
      label: 'Avg duration',
      value:
        summary.avgDurationSeconds === null ? '—' : formatDuration(summary.avgDurationSeconds),
    },
  ]
  return (
    <section
      aria-label="All-cardio totals"
      className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((c) => (
        <article
          key={c.key}
          data-testid={`overview-stat-${c.key}`}
          className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-4 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
        >
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/70">
            {c.label}
          </h3>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0a0a0a]">
            {c.value}
          </p>
        </article>
      ))}
    </section>
  )
}

interface ChartCardProps {
  title: string
  helper: string
  /** When set, the card sits full-width (used for the training-load row). */
  wide?: boolean
  /** Optional content rendered after the chart body — e.g. a legend. */
  footer?: JSX.Element
  /**
   * Optional control rendered to the right of the title — used by the
   * Training Load card to host the max-HR override. Wraps to the next line
   * on narrow screens via the parent header's `flex-wrap`.
   */
  headerSlot?: JSX.Element
  children: JSX.Element
}

function ChartCard({
  title,
  helper,
  wide,
  footer,
  headerSlot,
  children,
}: ChartCardProps): JSX.Element {
  return (
    <section
      className={`${wide ? 'mt-6 ' : ''}rounded-[1.6rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_18px_46px_rgba(0,0,0,0.34)]`}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#0a0a0a]">
          {title}
        </h2>
        {headerSlot}
      </header>
      <p className="mb-4 text-xs leading-5 text-[#404040]">{helper}</p>
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </section>
  )
}

interface ActivityMixProps {
  counts: readonly ActivityCount[]
}

/**
 * Compact per-activity breakdown — one card per activity showing session count
 * and total time. Sits below the training-load chart so the "and what was the
 * mix?" question is answered without forcing the user to read the avg-HR
 * legend and count bars.
 */
function ActivityMix({ counts }: ActivityMixProps): JSX.Element {
  const totalDurationAll = counts.reduce((acc, c) => acc + c.totalDurationSeconds, 0)
  return (
    <section
      aria-label="Activity mix"
      className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/25 p-5"
    >
      <header className="mb-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white/80">
          Activity mix
        </h2>
        <p className="mt-1 text-xs text-white/55">
          Sessions and total time per activity in the selected range.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-3">
        {counts.map((row) => {
          const visual = ACTIVITY_VISUALS[row.activity]
          const sharePct =
            totalDurationAll > 0
              ? Math.round((row.totalDurationSeconds / totalDurationAll) * 100)
              : 0
          return (
            <li
              key={row.activity}
              data-testid={`activity-mix-${row.activity}`}
              className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: visual.color }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
                  {visual.label}
                </span>
              </div>
              <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-[#fff7ec]">
                {row.sessionCount}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {formatTotalDuration(row.totalDurationSeconds)}
                {row.sessionCount > 0 && totalDurationAll > 0 ? (
                  <span className="ml-2 text-white/35">({sharePct}%)</span>
                ) : null}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface SessionLogTableProps {
  sessions: readonly CardioSession[]
  range: DateRange
}

function SessionLogTable({ sessions, range }: SessionLogTableProps): JSX.Element {
  const rows = useMemo(() => sessions.slice().reverse(), [sessions])
  const startLabel = formatRangeBound(range.start, 'start')
  const endLabel = formatRangeBound(range.end, 'end')

  return (
    <section className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/25 p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white/80">
          Sessions
        </h2>
        <p className="text-xs text-white/55">
          {sessions.length === 0 ? 'No sessions in range' : `${sessions.length} in range`}
          <span className="ml-2 text-white/35">
            ({startLabel} → {endLabel})
          </span>
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-white/55">
          No cardio sessions in the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-white/55">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Activity
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Distance
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Duration
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Pace
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Avg HR
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Max HR
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Zone
                </th>
              </tr>
            </thead>
            <tbody className="text-[#f7ead9]">
              {rows.map((s, i) => {
                const visual = ACTIVITY_VISUALS[s.activity]
                return (
                  <tr
                    key={`${s.date}-${s.activity}-${s.duration_seconds}-${i}`}
                    className="rounded-md bg-white/5 align-middle"
                  >
                    <td className="rounded-l-md px-3 py-2 font-mono">
                      {formatRowDate(s.date)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: visual.color }}
                        />
                        {visual.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatDistanceMiles(s.distance_meters)}
                    </td>
                    <td className="px-3 py-2 font-mono">{formatDuration(s.duration_seconds)}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaceCellFromSecPerKm(s.pace_seconds_per_km)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {typeof s.avg_hr === 'number' ? `${Math.round(s.avg_hr)}` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {typeof s.max_hr === 'number' ? `${Math.round(s.max_hr)}` : '—'}
                    </td>
                    <td className="rounded-r-md px-3 py-2 font-mono">
                      <SessionZoneStrip hrSecondsInZone={s.hr_seconds_in_zone} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatRowDate(raw: string): string {
  const d = parseSessionDate(raw)
  if (!Number.isFinite(d.getTime())) return raw
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatRangeBound(d: Date, end: 'start' | 'end'): string {
  const norm = end === 'start' ? startOfDay(d) : endOfDay(d)
  return `${norm.getFullYear()}-${String(norm.getMonth() + 1).padStart(2, '0')}-${String(norm.getDate()).padStart(2, '0')}`
}

function LoadingPanel(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-10 rounded-[1.6rem] border border-white/10 bg-black/25 p-8 text-center text-sm text-white/65"
    >
      Loading cardio data…
    </div>
  )
}

function ErrorPanel({ error }: { error: Error }): JSX.Element {
  return (
    <div
      role="alert"
      className="mt-10 rounded-[1.6rem] border border-red-400/30 bg-red-950/40 p-6 text-sm leading-6 text-red-100"
    >
      <p className="font-semibold uppercase tracking-[0.18em]">Could not load cardio data</p>
      <p className="mt-2 text-red-100/80">{error.message}</p>
      <p className="mt-4 text-xs text-red-100/60">
        Run <code className="rounded bg-black/40 px-1.5 py-0.5">npm run import-health</code> to
        regenerate <code className="rounded bg-black/40 px-1.5 py-0.5">public/data/cardio.json</code>{' '}
        from a fresh Apple Health export, then redeploy.
      </p>
    </div>
  )
}
