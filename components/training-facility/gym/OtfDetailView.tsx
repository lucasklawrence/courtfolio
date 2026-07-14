'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { RoughLine } from '@/components/training-facility/shared/charts/RoughLine'
import { defaultMargin } from '@/components/training-facility/shared/charts/types'
import {
  DateFilter,
  rangeForPreset,
  type DateRange,
} from '@/components/training-facility/shared/DateFilter'
import { useAdminSession } from '@/lib/auth/use-admin-session'
import { getOtfData, getOtfMileageAwards } from '@/lib/data'
import {
  OTF_ZONES,
  aggregateOtfZoneMinutes,
  earliestOtfDate,
  effectiveOtfClassType,
  excludeInvalidOtfSessions,
  filterOtfSessionsByClassType,
  filterOtfSessionsInRange,
  formatMmss,
  formatOtfDate,
  mmssToSeconds,
  otfBlockTrend,
  otfClassTypes,
  otfHighlights,
  otfLinearRegression,
  otfMetricTrend,
  resolveOtfClassTypeFilter,
  type OtfTrendPoint,
} from '@/lib/training-facility/otf'
import type { OtfData, OtfMileageAward, OtfRower, OtfSession, OtfTreadmill } from '@/types/otf'

import { OtfMileageSection } from './OtfMileageSection'
import { OtfSparklineSummary, type OtfSparklineRow } from './OtfSparklineSummary'
import { OtfZoneBars } from './OtfZoneBars'

const CHART_HEIGHT = 280
const MIN_CHART_WIDTH = 280
const DEFAULT_CHART_WIDTH = 560
const EARLIEST_FALLBACK = new Date(2026, 0, 1)
const FONT_FAMILY = "'Patrick Hand', system-ui, sans-serif"

/** Empty dataset used while loading resolves to "no sessions yet" instead of spinning forever. */
const EMPTY_OTF: OtfData = { imported_at: '', sessions: [] }

/**
 * OrangeTheory detail view (#256) — renders the `otf_sessions` data the
 * OTbeat ingestion pipeline (#251) feeds into Supabase. Sibling of the
 * cardio Gym detail views (`TreadmillDetailView` et al.): same dark-arena
 * shell, `DateFilter`, `ChartCard` chrome, and loading/error panels, with
 * OTF-specific charts — minutes-in-zone bars (gray→red) and splat / calorie
 * / avg-HR trend lines — plus an expandable session log surfacing each
 * class's treadmill and rower performance blocks.
 */
export function OtfDetailView(): JSX.Element {
  const [data, setData] = useState<OtfData | null>(null)
  // Milestone ladder for the monthly-mileage section (#321). Independent of the
  // session read: a failure here downgrades to an empty ladder (no badges)
  // rather than blanking the page, so it never blocks the charts.
  const [mileageAwards, setMileageAwards] = useState<OtfMileageAward[]>([])
  const { isAdmin } = useAdminSession()
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('ALL', EARLIEST_FALLBACK))
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH)
  // Coarse class-type filter (#271); `null` = "All". Scopes both the log and
  // every aggregate, composing with the date range and the #268 exclusion.
  const [classType, setClassType] = useState<string | null>(null)

  // The chart wrapper mounts only after data arrives (it lives inside the data
  // branch), so observe it via a callback ref. A mount effect would run while
  // the node is still null and never attach, freezing the width at the default.
  const observerRef = useRef<ResizeObserver | null>(null)
  const measureChart = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const next = Math.max(MIN_CHART_WIDTH, Math.floor(entry.contentRect.width))
        setChartWidth(prev => (prev === next ? prev : next))
      }
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  // Track manual range edits so the post-load re-anchor doesn't stomp them.
  const userAdjustedRange = useRef(false)
  const handleRangeChange = useCallback((next: DateRange) => {
    userAdjustedRange.current = true
    setRange(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    getOtfData()
      .then(otf => {
        if (cancelled) return
        // `getOtfData()` resolves to `null` when `otf_sessions` is empty;
        // substitute an empty dataset so we land on the empty state rather
        // than the perpetual loading panel.
        setData(otf ?? EMPTY_OTF)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err : new Error(String(err)))
      })
    // Load the milestone ladder in parallel; its failure is non-fatal (the
    // mileage section just shows no badges), so it has its own catch and never
    // trips `loadError`.
    getOtfMileageAwards()
      .then(awards => {
        if (cancelled) return
        setMileageAwards(awards)
      })
      .catch(() => {
        /* leave the ladder empty — the section renders miles with no badges */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const earliest = useMemo(
    () => (data ? (earliestOtfDate(data.sessions) ?? EARLIEST_FALLBACK) : EARLIEST_FALLBACK),
    [data]
  )

  // Re-anchor the default "All" range once the real earliest session date is
  // known — the dataset loads after mount, so the mount-time range was built
  // from EARLIEST_FALLBACK. Skipped after the user picks a range.
  useEffect(() => {
    if (userAdjustedRange.current || !data) return
    setRange(rangeForPreset('ALL', earliest))
  }, [earliest, data])

  const rangeSessions = useMemo(
    () => (data ? filterOtfSessionsInRange(data.sessions, range) : []),
    [data, range]
  )
  // Class types present in the current window drive the filter chips. Derived
  // before the class filter so every option stays reachable.
  const availableClassTypes = useMemo(() => otfClassTypes(rangeSessions), [rangeSessions])

  // Reconcile the stored selection against the window synchronously: `effective`
  // is what actually filters this render (never a stale value), `visible` keeps
  // the control — and its "All" clear button — reachable while a filter is on.
  const { effective: effectiveClassType, visible: showClassTypeFilter } = useMemo(
    () => resolveOtfClassTypeFilter(classType, availableClassTypes),
    [classType, availableClassTypes]
  )

  // Tidy the stored state when the selection leaves the window (e.g. the range
  // narrowed past it) so a later widen doesn't silently resurrect the filter.
  // `effectiveClassType` already prevents a stale-render flicker meanwhile.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional cleanup: drop a stored class-type filter once it leaves the available window
    if (classType && !availableClassTypes.includes(classType)) setClassType(null)
  }, [classType, availableClassTypes])

  // Apply the class-type filter on top of the date range; this scoped set feeds
  // both the log and (after exclusion) every aggregate.
  const sessions = useMemo(
    () => filterOtfSessionsByClassType(rangeSessions, effectiveClassType),
    [rangeSessions, effectiveClassType]
  )
  // Aggregates, trends, sparklines, and highlights run over the *active*
  // sessions only — invalid/anomalous classes (e.g. an equipment malfunction,
  // #268) are dropped so they can't skew a total, average, or trend line. The
  // full `sessions` set still feeds the session log, which shows them muted.
  const activeSessions = useMemo(() => excludeInvalidOtfSessions(sessions), [sessions])
  const buckets = useMemo(() => aggregateOtfZoneMinutes(activeSessions), [activeSessions])
  const splatTrend = useMemo(() => otfMetricTrend(activeSessions, 'splat'), [activeSessions])
  const calorieTrend = useMemo(() => otfMetricTrend(activeSessions, 'calories'), [activeSessions])
  const hrTrend = useMemo(() => otfMetricTrend(activeSessions, 'avg_hr'), [activeSessions])
  const treadDistanceTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'treadmill', t => t.distance_mi),
    [activeSessions]
  )
  const treadPaceTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'treadmill', t => mmssToSeconds(t.avg_pace)),
    [activeSessions]
  )
  const rowerDistanceTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'rower', r => r.distance_m),
    [activeSessions]
  )
  const rowerSplitTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'rower', r => mmssToSeconds(r.split_500m)),
    [activeSessions]
  )
  const treadInclineTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'treadmill', t => t.avg_incline),
    [activeSessions]
  )
  const rowerWattsTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'rower', r => r.avg_watt),
    [activeSessions]
  )
  // Machine time-on-machine, parsed from the "MM:SS" block field, feeds the
  // combined overlays alongside distance and pace/watts.
  const treadTimeTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'treadmill', t => mmssToSeconds(t.time)),
    [activeSessions]
  )
  const rowerTimeTrend = useMemo(
    () => otfBlockTrend(activeSessions, 'rower', r => mmssToSeconds(r.time)),
    [activeSessions]
  )
  const treadRows = useMemo<OtfSparklineRow[]>(
    () => [
      { key: 'distance', label: 'Distance', trend: treadDistanceTrend, format: v => `${v.toFixed(2)} mi` },
      { key: 'time', label: 'Time', trend: treadTimeTrend, format: formatMmss },
      { key: 'pace', label: 'Avg pace', trend: treadPaceTrend, format: v => `${formatMmss(v)}/mi` },
      { key: 'incline', label: 'Avg incline', trend: treadInclineTrend, format: v => `${v.toFixed(1)}%` },
    ],
    [treadDistanceTrend, treadTimeTrend, treadPaceTrend, treadInclineTrend]
  )
  const rowerRows = useMemo<OtfSparklineRow[]>(
    () => [
      { key: 'distance', label: 'Distance', trend: rowerDistanceTrend, format: v => `${Math.round(v)} m` },
      { key: 'time', label: 'Time', trend: rowerTimeTrend, format: formatMmss },
      { key: 'watts', label: 'Avg watts', trend: rowerWattsTrend, format: v => `${Math.round(v)} W` },
      { key: 'split', label: '500m split', trend: rowerSplitTrend, format: v => `${formatMmss(v)}/500m` },
    ],
    [rowerDistanceTrend, rowerTimeTrend, rowerWattsTrend, rowerSplitTrend]
  )
  const highlights = useMemo(() => otfHighlights(activeSessions), [activeSessions])

  const hasAnySessions = !!data && data.sessions.length > 0

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_52%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackToCourtButton />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/training-facility/gym/zones"
              className="rounded-full border border-[#f97316]/40 bg-[#f97316]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#f9a870] transition hover:bg-[#f97316]/20"
            >
              Zones vs Apple →
            </Link>
            <Link
              href="/training-facility/gym"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
            >
              ← The Gym
            </Link>
          </div>
        </div>

        <header className="mt-12">
          <div className="text-xs font-semibold uppercase tracking-[0.38em] text-[#f97316]">
            OrangeTheory
          </div>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em] text-[#fff7ec] sm:text-5xl">
            Splat points, zones, and the row-tread grind
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Every studio class, straight from the OTbeat summary emails — time in each HR zone,
            splat and calorie trends, and the treadmill + rower splits underneath each session.
            Scoped to the date range.
          </p>
        </header>

        {data ? (
          <OtfMileageSection
            sessions={data.sessions}
            awards={mileageAwards}
            isAdmin={isAdmin}
          />
        ) : null}

        <div className="mt-8">
          <DateFilter
            key={earliest.getTime()}
            earliestDate={earliest}
            defaultPreset="ALL"
            onChange={handleRangeChange}
          />
        </div>

        {showClassTypeFilter && (
          <ClassTypeFilter
            options={availableClassTypes}
            value={effectiveClassType}
            onChange={setClassType}
          />
        )}

        {loadError ? (
          <ErrorPanel error={loadError} />
        ) : !data ? (
          <LoadingPanel />
        ) : !hasAnySessions ? (
          <EmptyState />
        ) : (
          <>
            <HighlightStrip highlights={highlights} />

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Minutes in zone"
                helper="Total minutes per OTbeat HR zone across the filtered window."
              >
                <div ref={measureChart}>
                  <OtfZoneBars
                    buckets={buckets}
                    width={chartWidth}
                    height={CHART_HEIGHT}
                    fontFamily={FONT_FAMILY}
                  />
                </div>
              </ChartCard>

              <ChartCard
                title="Splat points per class"
                helper="Minutes in the orange + red zones. One point per class."
              >
                <OtfTrendChart
                  data={splatTrend}
                  width={chartWidth}
                  yLabel="Splat"
                  ariaLabel="Splat points per class over time"
                  emptyMessage="No splat data in range"
                />
              </ChartCard>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Calories per class"
                helper="Total calories burned, one point per class."
              >
                <OtfTrendChart
                  data={calorieTrend}
                  width={chartWidth}
                  yLabel="Calories"
                  ariaLabel="Calories per class over time"
                  emptyMessage="No calorie data in range"
                />
              </ChartCard>

              <ChartCard title="Average heart rate" helper="Mean HR per class, BPM.">
                <OtfTrendChart
                  data={hrTrend}
                  width={chartWidth}
                  yLabel="Avg HR"
                  ariaLabel="Average heart rate per class over time"
                  emptyMessage="No heart-rate data in range"
                />
              </ChartCard>
            </div>

            <SectionLabel>Treadmill</SectionLabel>
            <div className="mt-4">
              <ChartCard
                title="At a glance"
                helper="Each metric's own trend across the range, first → latest. Sparklines share the date axis; each keeps its own scale (compare direction, not magnitudes)."
              >
                <OtfSparklineSummary rows={treadRows} ariaLabelPrefix="Treadmill" />
              </ChartCard>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Distance per class" helper="Treadmill miles per class.">
                <OtfTrendChart
                  data={treadDistanceTrend}
                  width={chartWidth}
                  yLabel="Miles"
                  yTickFormat={v => v.toFixed(2)}
                  ariaLabel="Treadmill distance per class over time"
                  emptyMessage="No treadmill distance in range"
                />
              </ChartCard>
              <ChartCard
                title="Avg pace"
                helper="Average treadmill pace per mile — lower is faster."
              >
                <OtfTrendChart
                  data={treadPaceTrend}
                  width={chartWidth}
                  yLabel="min/mi"
                  yTickFormat={formatMmss}
                  ariaLabel="Treadmill average pace over time"
                  emptyMessage="No treadmill pace in range"
                />
              </ChartCard>
              <ChartCard
                title="Avg incline"
                helper="Average treadmill incline — context for pace (a slow mile may be a steep one)."
              >
                <OtfTrendChart
                  data={treadInclineTrend}
                  width={chartWidth}
                  yLabel="Incline %"
                  yTickFormat={v => v.toFixed(1)}
                  ariaLabel="Treadmill average incline over time"
                  emptyMessage="No treadmill incline in range"
                />
              </ChartCard>
            </div>

            <SectionLabel>Rower</SectionLabel>
            <div className="mt-4">
              <ChartCard
                title="At a glance"
                helper="Each metric's own trend across the range, first → latest. Sparklines share the date axis; each keeps its own scale (compare direction, not magnitudes)."
              >
                <OtfSparklineSummary rows={rowerRows} ariaLabelPrefix="Rower" />
              </ChartCard>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Distance per class" helper="Rower meters per class.">
                <OtfTrendChart
                  data={rowerDistanceTrend}
                  width={chartWidth}
                  yLabel="Meters"
                  ariaLabel="Rower distance per class over time"
                  emptyMessage="No rower distance in range"
                />
              </ChartCard>
              <ChartCard title="500m split" helper="Average time per 500m — lower is faster.">
                <OtfTrendChart
                  data={rowerSplitTrend}
                  width={chartWidth}
                  yLabel="/500m"
                  yTickFormat={formatMmss}
                  ariaLabel="Rower 500m split over time"
                  emptyMessage="No rower split in range"
                />
              </ChartCard>
              <ChartCard
                title="Avg watts"
                helper="Average rower power output — higher is stronger."
              >
                <OtfTrendChart
                  data={rowerWattsTrend}
                  width={chartWidth}
                  yLabel="Watts"
                  ariaLabel="Rower average wattage over time"
                  emptyMessage="No rower wattage in range"
                />
              </ChartCard>
            </div>

            <SessionLogTable sessions={sessions} range={range} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Coarse class-type filter (#271) — an "All" pill plus one per available
 * inferred/overridden type. Selecting one scopes the whole view (aggregates +
 * log). Rendered only when 2+ types are present in the window.
 */
function ClassTypeFilter({
  options,
  value,
  onChange,
}: {
  options: readonly string[]
  value: string | null
  onChange: (next: string | null) => void
}): JSX.Element {
  const pill = (active: boolean): string =>
    `rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
      active
        ? 'border-[#f97316]/60 bg-[#f97316]/20 text-[#f9a870]'
        : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
    }`
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/45">
        Class type
      </span>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={pill(value === null)}
      >
        All
      </button>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={pill(value === opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

/** Shared trend-line chart — `RoughLine` over `{date, value}` points with the OTF font/tick style. */
function OtfTrendChart({
  data,
  width,
  yLabel,
  ariaLabel,
  emptyMessage,
  yTickFormat,
}: {
  data: OtfTrendPoint[]
  width: number
  yLabel: string
  ariaLabel: string
  emptyMessage: string
  /** Optional y-axis tick formatter (e.g. `formatMmss` for pace/split). Defaults to whole numbers. */
  yTickFormat?: (value: number) => string
}): JSX.Element {
  // Least-squares trend line drawn as a dashed overlay — the "am I improving?"
  // read. `null` (fewer than two classes, or all on one day) hides it.
  const regression = otfLinearRegression(data)
  const overlay = regression?.points.map(p => ({ x: p.date, y: p.value }))
  return (
    <RoughLine<OtfTrendPoint>
      data={data}
      x={p => p.date}
      y={p => p.value}
      width={width}
      height={CHART_HEIGHT}
      margin={defaultMargin}
      fontFamily={FONT_FAMILY}
      yLabel={yLabel}
      yTickFormat={yTickFormat ?? (v => `${Math.round(v)}`)}
      overlay={overlay}
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
    />
  )
}

/** Small orange divider label for the machine-specific chart groups. */
function SectionLabel({ children }: { children: string }): JSX.Element {
  return (
    <h2 className="mt-10 font-mono text-sm font-bold uppercase tracking-[0.28em] text-[#f97316]">
      {children}
    </h2>
  )
}

/** Headline stat tiles for the active range. */
function HighlightStrip({
  highlights,
}: {
  highlights: ReturnType<typeof otfHighlights>
}): JSX.Element {
  const tiles: Array<{ label: string; value: string }> = [
    { label: 'Classes', value: `${highlights.classes}` },
    { label: 'Total splat', value: `${highlights.totalSplat}` },
    { label: 'Avg splat', value: highlights.avgSplat.toFixed(1) },
    { label: 'Best splat', value: `${highlights.bestSplat}` },
    { label: 'Total calories', value: highlights.totalCalories.toLocaleString() },
    { label: 'Best calories', value: highlights.bestCalories.toLocaleString() },
  ]
  return (
    <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(t => (
        <div
          key={t.label}
          className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center"
        >
          <dt className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
            {t.label}
          </dt>
          <dd className="mt-1 text-2xl font-black text-[#f97316]">{t.value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface ChartCardProps {
  title: string
  helper: string
  children: JSX.Element
}

/** Cream chart card chrome — mirrors the inline `ChartCard` in the cardio detail views. */
function ChartCard({ title, helper, children }: ChartCardProps): JSX.Element {
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#0a0a0a]">
          {title}
        </h2>
      </header>
      <p className="mb-4 text-xs leading-5 text-[#404040]">{helper}</p>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

interface SessionLogTableProps {
  sessions: readonly OtfSession[]
  range: DateRange
}

/** Per-class log with rows expandable to the treadmill + rower performance blocks. */
function SessionLogTable({ sessions, range }: SessionLogTableProps): JSX.Element {
  // Newest first.
  const rows = useMemo(() => sessions.slice().reverse(), [sessions])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // The log lists excluded classes too (muted), so split the count: N valid
  // classes drive the aggregates; excluded ones are called out separately.
  const excludedCount = useMemo(() => sessions.filter(s => s.excluded).length, [sessions])
  const activeCount = sessions.length - excludedCount

  return (
    <section className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/25 p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white/80">
          Classes
        </h2>
        <p className="text-xs text-white/55">
          {sessions.length === 0 ? 'No classes in range' : `${activeCount} in range`}
          {excludedCount > 0 && (
            <span className="ml-1 text-[#f9a870]/80">· {excludedCount} excluded</span>
          )}
          <span className="ml-2 text-white/35">
            ({formatBound(range.start)} → {formatBound(range.end)})
          </span>
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-white/55">
          No OrangeTheory classes in the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-white/55">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Coach
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Type
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Splat
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Calories
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Avg HR
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Peak HR
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  <span className="sr-only">Expand</span>
                </th>
              </tr>
            </thead>
            <tbody className="text-[#f7ead9]">
              {rows.map((s, i) => {
                const rowKey = `${s.started_at}-${i}`
                const excluded = !!s.excluded
                // Excluded rows are always expandable so the exclusion reason
                // stays reachable even when the class has no machine/zone block.
                const expandable = !!s.treadmill || !!s.rower || !!s.zones_min || excluded
                const isExpanded = expandedKey === rowKey
                const toggle = () => {
                  if (!expandable) return
                  setExpandedKey(isExpanded ? null : rowKey)
                }
                return (
                  <Fragment key={rowKey}>
                    <tr
                      className={`rounded-md align-middle ${excluded ? 'bg-white/[0.02] opacity-55' : 'bg-white/5'} ${
                        expandable
                          ? 'cursor-pointer transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60'
                          : ''
                      }`}
                      {...(expandable
                        ? {
                            role: 'button',
                            tabIndex: 0,
                            'aria-expanded': isExpanded,
                            onClick: toggle,
                            onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggle()
                              }
                            },
                          }
                        : {})}
                    >
                      <td className="rounded-l-md px-3 py-2 font-mono">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span
                            className={excluded ? 'line-through decoration-white/40' : undefined}
                          >
                            {formatOtfDate(s)}
                          </span>
                          {excluded && (
                            <span
                              title={s.excluded_reason ?? undefined}
                              className="rounded-full border border-[#f9a870]/40 bg-[#f9a870]/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#f9a870]"
                            >
                              Excluded
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2">{s.coach ?? '—'}</td>
                      <td className="px-3 py-2">
                        <ClassTypeCell session={s} />
                      </td>
                      <td
                        className={`px-3 py-2 font-mono ${excluded ? 'text-white/50' : 'text-[#f97316]'}`}
                      >
                        {numCell(s.splat)}
                      </td>
                      <td className="px-3 py-2 font-mono">{numCell(s.calories)}</td>
                      <td className="px-3 py-2 font-mono">{numCell(s.avg_hr)}</td>
                      <td className="px-3 py-2 font-mono">{numCell(s.peak_hr)}</td>
                      <td className="rounded-r-md px-3 py-2 text-right font-mono text-white/45">
                        {expandable ? (isExpanded ? '▾' : '▸') : ''}
                      </td>
                    </tr>
                    {isExpanded && expandable && (
                      <tr>
                        <td colSpan={8} className="px-3 pb-3">
                          <ExpandedSession session={s} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Expanded row body: zone minutes plus the treadmill and rower performance blocks. */
function ExpandedSession({ session }: { session: OtfSession }): JSX.Element {
  // Capture into a local so the truthiness narrowing carries into the `.map`
  // callback (a property access doesn't stay narrowed across the closure).
  const zones = session.zones_min
  return (
    <div className="space-y-3">
      {session.excluded && (
        <p className="rounded-lg border border-[#f9a870]/30 bg-[#f9a870]/10 px-3 py-2 text-xs leading-5 text-[#f9c79b]">
          <span className="font-semibold uppercase tracking-[0.14em]">Excluded from charts</span>
          {session.excluded_reason ? ` — ${session.excluded_reason}` : ''}
        </p>
      )}
      <div className="grid gap-4 rounded-xl bg-black/30 p-4 text-xs sm:grid-cols-3">
        <div>
          <p className="mb-2 font-mono uppercase tracking-[0.18em] text-white/55">Zones</p>
          {zones ? (
            <ul className="space-y-1">
              {OTF_ZONES.map(z => (
                <li key={z.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: z.color }}
                  />
                  <span className="text-white/70">{z.shortLabel}</span>
                  <span className="ml-auto font-mono text-white/90">{zones[z.key]}m</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/45">No zone data.</p>
          )}
        </div>
        <StatBlock title="Treadmill" rows={treadmillRows(session.treadmill)} />
        <StatBlock title="Rower" rows={rowerRows(session.rower)} />
      </div>
    </div>
  )
}

/** A labeled stat list used by the treadmill / rower blocks. Renders a placeholder when absent. */
function StatBlock({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, string]> | null
}): JSX.Element {
  return (
    <div>
      <p className="mb-2 font-mono uppercase tracking-[0.18em] text-white/55">{title}</p>
      {rows ? (
        <dl className="space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <dt className="text-white/60">{label}</dt>
              <dd className="font-mono text-white/90">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-white/45">Not in this class format.</p>
      )}
    </div>
  )
}

/** Format the treadmill block into label/value pairs, or `null` when absent. */
function treadmillRows(t: OtfTreadmill | undefined): Array<[string, string]> | null {
  if (!t) return null
  const rows: Array<[string, string]> = [
    ['Distance', `${t.distance_mi} mi`],
    ['Time', t.time],
  ]
  if (t.avg_pace) rows.push(['Avg pace', `${t.avg_pace}/mi`])
  if (t.fastest_pace) rows.push(['Best pace', `${t.fastest_pace}/mi`])
  if (t.avg_mph !== undefined) rows.push(['Avg speed', `${t.avg_mph} mph`])
  if (t.avg_incline !== undefined) rows.push(['Avg incline', `${t.avg_incline}%`])
  if (t.elevation_ft !== undefined) rows.push(['Elevation', `${t.elevation_ft} ft`])
  return rows
}

/** Format the rower block into label/value pairs, or `null` when absent. */
function rowerRows(r: OtfRower | undefined): Array<[string, string]> | null {
  if (!r) return null
  const rows: Array<[string, string]> = [
    ['Distance', `${r.distance_m} m`],
    ['Time', r.time],
  ]
  if (r.split_500m) rows.push(['Avg /500m', r.split_500m])
  if (r.best_split_500m) rows.push(['Best /500m', r.best_split_500m])
  if (r.avg_watt !== undefined) rows.push(['Avg watts', `${r.avg_watt}`])
  if (r.avg_spm !== undefined) rows.push(['Avg SPM', `${r.avg_spm}`])
  return rows
}

/**
 * The session's effective class type (#271) as a small chip, or an em dash when
 * none. A trailing dot marks a manual `class_type_override`; the `title`
 * distinguishes an override from the auto-inferred label on hover.
 */
function ClassTypeCell({ session }: { session: OtfSession }): JSX.Element {
  const type = effectiveOtfClassType(session)
  if (!type) return <span className="text-white/35">—</span>
  const isOverride = !!session.class_type_override?.trim()
  return (
    <span
      title={isOverride ? 'Manual override' : 'Inferred from machine signature'}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.65rem] font-medium text-white/75"
    >
      {type}
      {isOverride && (
        <span aria-hidden="true" className="text-[#f9a870]">
          •
        </span>
      )}
    </span>
  )
}

/** Render a numeric cell, rounding to a whole number, or an em dash when absent. */
function numCell(value: number | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)}` : '—'
}

/** `YYYY-MM-DD` for a date-range bound. */
function formatBound(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function LoadingPanel(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-10 rounded-[1.6rem] border border-white/10 bg-black/25 p-8 text-center text-sm text-white/65"
    >
      Loading OrangeTheory data…
    </div>
  )
}

function EmptyState(): JSX.Element {
  return (
    <div className="mt-10 rounded-[1.6rem] border border-white/10 bg-black/25 p-8 text-center text-sm leading-6 text-white/65">
      <p className="font-semibold uppercase tracking-[0.18em] text-white/80">
        No OrangeTheory classes yet
      </p>
      <p className="mt-2 text-white/55">
        Sessions land here automatically each week as the OTbeat summary emails are ingested.
      </p>
    </div>
  )
}

function ErrorPanel({ error }: { error: Error }): JSX.Element {
  return (
    <div
      role="alert"
      className="mt-10 rounded-[1.6rem] border border-red-400/30 bg-red-950/40 p-6 text-sm leading-6 text-red-100"
    >
      <p className="font-semibold uppercase tracking-[0.18em]">Could not load OrangeTheory data</p>
      <p className="mt-2 text-red-100/80">{error.message}</p>
    </div>
  )
}
