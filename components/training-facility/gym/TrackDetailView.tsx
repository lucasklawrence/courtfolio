'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { CardioData, CardioSession } from '@/types/cardio'
import type { Benchmark } from '@/types/movement'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import { getCardioData, getMovementBenchmarks } from '@/lib/data'
import {
  useCardioPreview,
  useCardioPreviewHref,
} from '@/lib/training-facility/use-cardio-preview'
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
  perSessionAvgHr,
} from '@/lib/training-facility/cardio-shared'
import {
  cardiacEfficiencyPoints,
  formatDistanceMiles,
  formatPaceCellFromSecPerKm,
  formatPacePerMile,
  paceAtHrPoints,
  paceTrendPoints,
  type PaceTrendPoint,
} from '@/lib/training-facility/running'
import { filterWalkingSessions } from '@/lib/training-facility/walking'
import { computePersonalBests } from '@/lib/training-facility/personal-bests'
import { PersonalBests } from './PersonalBests'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { HrZoneBars } from './HrZoneBars'
import { AvgHrBars } from './AvgHrBars'
import { RoughLine } from '@/components/training-facility/shared/charts/RoughLine'
import { RoughScatter } from '@/components/training-facility/shared/charts/RoughScatter'
import { BodyweightOverlay } from '@/components/training-facility/shared/charts/BodyweightOverlay'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import { defaultMargin } from '@/components/training-facility/shared/charts/types'
import { TrainingLoadChart } from './TrainingLoadChart'
import {
  trainingLoadInRange,
  type TrainingLoadPoint,
} from '@/lib/training-facility/training-load'
import { DEFAULT_MAX_HR } from '@/constants/hr-zones'
import { MaxHrControl } from './MaxHrControl'

const CHART_HEIGHT = 280
const PACE_CHART_HEIGHT = 300
const MIN_CHART_WIDTH = 280
const DEFAULT_CHART_WIDTH = 560
const DEFAULT_PACE_WIDTH = 880
const EARLIEST_FALLBACK = new Date(2024, 0, 1)
const FONT_FAMILY = "'Patrick Hand', system-ui, sans-serif"

/**
 * Track detail view (PRD §7.4) — walking-modality charts over the cardio
 * data layer. Mirrors `TreadmillDetailView` for shared concerns (HR-zone bars,
 * per-session avg-HR, session log, pace trend with bodyweight overlay,
 * cardiac efficiency, pace-at-HR scatter, training load) — the only
 * differences are the walking-only filter and the equipment-specific copy
 * framing walking as recovery / aerobic-base work rather than the speed work
 * treadmill is for.
 *
 * Note: the training-load chart aggregates ALL cardio activities (TRIMP is a
 * whole-athlete metric — PRD #78), so its scope is wider than the rest of the
 * charts on this page.
 *
 * Shares pace projection helpers with running (see {@link ./running}) since
 * those are activity-agnostic; only the activity filter is walking-specific.
 *
 * Loading and error states are first-class so a missing `cardio.json` reads
 * as "no data yet" rather than an empty chart wall.
 */
export function TrackDetailView(): JSX.Element {
  // `realData` is what `getCardioData()` returned; `data` (further
  // down) is the surface-rendered version after the preview hook
  // runs (#162).
  const [realData, setRealData] = useState<CardioData | null>(null)
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('1M', EARLIEST_FALLBACK))
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH)
  const [paceWidth, setPaceWidth] = useState(DEFAULT_PACE_WIDTH)
  // Max HR drives the runtime TRIMP formula. Defaults until `MaxHrControl`'s
  // mount-effect reads localStorage; same fallback as before #143 so SSR is
  // unchanged. Shared across all three Gym detail views via localStorage.
  const [maxHr, setMaxHr] = useState<number>(DEFAULT_MAX_HR)
  // Sentinel ref on a per-card wrapper — see StairDetailView for the rationale
  // (observing the grid wrapper would over-report on `lg:grid-cols-2`).
  const cardSizerRef = useRef<HTMLDivElement>(null)
  const paceSizerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getCardioData(), getMovementBenchmarks()])
      .then(([cardio, bench]) => {
        if (cancelled) return
        // `getCardioData()` resolves to `null` when every Supabase
        // cardio table is empty (#152). Substitute an empty `CardioData`
        // so the component progresses past the loading panel into the
        // empty-state branch.
        setRealData(
          cardio ?? {
            imported_at: '',
            sessions: [],
            resting_hr_trend: [],
            vo2max_trend: [],
          },
        )
        setBenchmarks(bench)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err : new Error(String(err)))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Empty-state preview affordance (#162). Activity-scoped to
  // `walking` so a DB with only stair / running data still surfaces
  // the preview here. Any real walking session suppresses both paths.
  const { data, isPreviewMode, showEmptyStateCta } = useCardioPreview(realData, {
    requireActivity: 'walking',
  })
  const previewHref = useCardioPreviewHref()

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
    const node = paceSizerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(MIN_CHART_WIDTH, Math.floor(entry.contentRect.width))
        setPaceWidth((prev) => (prev === next ? prev : next))
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

  const walkingSessions = useMemo<CardioSession[]>(
    () => (data ? filterWalkingSessions(data.sessions, range) : []),
    [data, range],
  )
  // Personal bests (issue #76) computed once per dataset; the active range +
  // filtered sessions feed the "PB in range" badge and inline best-in-range line.
  const bests = useMemo(
    () => (data ? computePersonalBests(data) : null),
    [data],
  )
  const buckets = useMemo(() => aggregateHrZoneSeconds(walkingSessions), [walkingSessions])
  const avgHrPoints = useMemo(() => perSessionAvgHr(walkingSessions), [walkingSessions])
  const paceTrend = useMemo(() => paceTrendPoints(walkingSessions), [walkingSessions])
  const efficiencyTrend = useMemo(
    () => cardiacEfficiencyPoints(walkingSessions),
    [walkingSessions],
  )
  const paceVsHr = useMemo(() => paceAtHrPoints(walkingSessions), [walkingSessions])

  // Training load aggregates ALL cardio activities (stair, running, walking) —
  // TRIMP / ATL / CTL is a whole-athlete metric and excluding modalities would
  // distort it. The helper pre-warms the EMA from the earliest session, then
  // clips to the active DateFilter window so the left edge doesn't show a
  // synthetic zero ramp.
  const trainingLoad = useMemo<TrainingLoadPoint[]>(
    () => (data ? trainingLoadInRange(data.sessions, range, { maxHr }) : []),
    [data, range, maxHr],
  )

  // Date extent for the pace chart and bodyweight overlay must match exactly
  // so the two x-axes line up. Falls back to the active filter range when the
  // data set has fewer than two points.
  const paceDateExtent = useMemo<[Date, Date]>(() => {
    if (paceTrend.length >= 2) {
      return [paceTrend[0].date, paceTrend[paceTrend.length - 1].date]
    }
    if (paceTrend.length === 1) {
      const d = paceTrend[0].date
      return [d, d]
    }
    return [range.start, range.end]
  }, [paceTrend, range])

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
            Track
          </div>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em] text-[#fff7ec] sm:text-5xl">
            Steady miles — the aerobic base under everything else
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Walking is recovery work — low heart rate, easy pace, time on
            feet. The same chart set as the treadmill, scoped to walks: zones
            stay light, pace inches faster as the engine improves, and the
            scatter clusters in the lower-left quadrant when easy days are
            actually easy.
          </p>
        </header>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="These cardio numbers are illustrative — not Lucas’s real Apple Health import." />
          </div>
        ) : null}
        {showEmptyStateCta ? (
          <div className="mt-6">
            <PreviewWithSampleDataButton
              href={previewHref}
              headline="No walking sessions logged yet"
              description="Curious what the page looks like with data? Load a sample set to populate the pace trend, cardiac-efficiency curve, and personal bests."
            />
          </div>
        ) : null}

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
            {bests && (
              <PersonalBests
                activity="walking"
                bests={bests}
                filteredSessions={walkingSessions}
                restingHrTrend={data.resting_hr_trend}
                vo2maxTrend={data.vo2max_trend}
                range={range}
              />
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Time in zone"
                helper="Total minutes per HR zone across the filtered window. Walks should sit mostly in Z1–Z2."
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
                helper="One bar per walk — a steady or downward trend means the engine is getting more efficient at the same pace."
              >
                <AvgHrBars
                  points={avgHrPoints}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fontFamily={FONT_FAMILY}
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Pace trend"
              helper="Pace per mile over time. Toggle the bodyweight overlay (§4) to see whether the pace is dropping because of the engine or because of the scale."
              wide
            >
              <div ref={paceSizerRef}>
                <BodyweightOverlay
                  benchmarks={benchmarks}
                  dateExtent={paceDateExtent}
                  width={paceWidth}
                  height={PACE_CHART_HEIGHT}
                  margin={defaultMargin}
                  fontFamily={FONT_FAMILY}
                  axisColor={chartPalette.inkSoft}
                >
                  <RoughLine<PaceTrendPoint>
                    data={paceTrend}
                    x={(p) => p.date}
                    y={(p) => p.paceSecondsPerMile}
                    width={paceWidth}
                    height={PACE_CHART_HEIGHT}
                    margin={defaultMargin}
                    fontFamily={FONT_FAMILY}
                    yLabel="Pace (min/mi)"
                    yTickFormat={formatTickPace}
                    ariaLabel="Walking pace per mile over time"
                    emptyMessage="No pace data in range"
                  />
                </BodyweightOverlay>
              </div>
            </ChartCard>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Cardiac efficiency"
                helper="Meters covered per heartbeat — higher is more efficient. Walks rack up more heartbeats per session, so trend over time matters more than absolute value."
              >
                <RoughLine
                  data={efficiencyTrend}
                  x={(p) => p.date}
                  y={(p) => p.metersPerHeartbeat}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fontFamily={FONT_FAMILY}
                  yLabel="m / heartbeat"
                  yTickFormat={(v) => v.toFixed(2)}
                  ariaLabel="Walking cardiac efficiency over time"
                  emptyMessage="No efficiency data in range"
                />
              </ChartCard>

              <ChartCard
                title="Pace at heart rate"
                helper="Each dot is one walk. Lower-left = the goal: brisk pace at low effort."
              >
                <RoughScatter
                  data={paceVsHr}
                  x={(p) => p.avgHr}
                  y={(p) => p.paceSecondsPerMile}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fontFamily={FONT_FAMILY}
                  xLabel="Avg HR (BPM)"
                  yLabel="Pace (min/mi)"
                  yTickFormat={formatTickPace}
                  ariaLabel="Walking pace vs. heart rate scatter"
                  emptyMessage="No pace + HR pairs in range"
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Training load"
              helper="ATL (acute, 7d) vs. CTL (chronic, 28d) and TSB = CTL − ATL. Aggregates all cardio activities; bands shade the freshness zones."
              wide
              headerSlot={<MaxHrControl onChange={setMaxHr} />}
            >
              <div>
                <TrainingLoadChart
                  points={trainingLoad}
                  width={paceWidth}
                  height={PACE_CHART_HEIGHT}
                  margin={defaultMargin}
                  fontFamily={FONT_FAMILY}
                  axisColor={chartPalette.inkSoft}
                  emptyMessage="No training load in selected range"
                />
              </div>
            </ChartCard>

            <SessionLogTable sessions={walkingSessions} range={range} />
          </>
        )}
      </div>
    </div>
  )
}

/** Tick formatter shared by pace y-axes — `M:SS` (no `/mi` suffix to keep ticks compact). */
function formatTickPace(secondsPerMile: number): string {
  const formatted = formatPacePerMile(secondsPerMile, false)
  return formatted === '—' ? '' : formatted
}

interface ChartCardProps {
  title: string
  helper: string
  /** When set, the card sits full-width (used for the pace-trend row). */
  wide?: boolean
  /**
   * Optional control rendered to the right of the title — used by the
   * Training Load card to host the max-HR override. Wraps to the next line
   * on narrow screens via the parent header's `flex-wrap`.
   */
  headerSlot?: JSX.Element
  children: JSX.Element
}

function ChartCard({ title, helper, wide, headerSlot, children }: ChartCardProps): JSX.Element {
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
          No walking sessions in the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-white/55">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Date
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
              </tr>
            </thead>
            <tbody className="text-[#f7ead9]">
              {rows.map((s, i) => (
                <tr
                  key={`${s.date}-${s.duration_seconds}-${i}`}
                  className="rounded-md bg-white/5 align-middle"
                >
                  <td className="rounded-l-md px-3 py-2 font-mono">{formatRowDate(s.date)}</td>
                  <td className="px-3 py-2 font-mono">{formatDistanceMiles(s.distance_meters)}</td>
                  <td className="px-3 py-2 font-mono">{formatDuration(s.duration_seconds)}</td>
                  <td className="px-3 py-2 font-mono">{formatPaceCellFromSecPerKm(s.pace_seconds_per_km)}</td>
                  <td className="px-3 py-2 font-mono">
                    {typeof s.avg_hr === 'number' ? `${Math.round(s.avg_hr)}` : '—'}
                  </td>
                  <td className="rounded-r-md px-3 py-2 font-mono">
                    {typeof s.max_hr === 'number' ? `${Math.round(s.max_hr)}` : '—'}
                  </td>
                </tr>
              ))}
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
