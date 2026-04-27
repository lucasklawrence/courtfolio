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
  filterStairSessions,
  formatDuration,
  parseSessionDate,
  perSessionAvgHr,
} from '@/lib/training-facility/stair'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { HrZoneBars } from './HrZoneBars'
import { AvgHrBars } from './AvgHrBars'

const CHART_HEIGHT = 280
const MIN_CHART_WIDTH = 280
const DEFAULT_CHART_WIDTH = 560
const EARLIEST_FALLBACK = new Date(2024, 0, 1)

/**
 * Stair-climber detail view (PRD §7.4) — the first Gym detail surface.
 *
 * Composes three views fed by `getCardioData()` and a shared `DateFilter`:
 *   1. Time-in-zone bars (`HrZoneBars`) — total seconds per Z1–Z5, summed
 *      across the filtered window.
 *   2. Per-session avg-HR bars (`AvgHrBars`) — one bar per session in range.
 *   3. Session log table — one row per session, oldest → newest.
 *
 * Loading and error are surfaced explicitly so a missing `cardio.json` (or a
 * future API outage) reads as "no data yet" instead of an empty chart trio.
 */
export function StairDetailView(): JSX.Element {
  const [data, setData] = useState<CardioData | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('1M', EARLIEST_FALLBACK))
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getCardioData()
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err : new Error(String(err)))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Track the cards' rendered width so the SVG charts shrink with the column
  // on mobile rather than overflowing the viewport. The shared chart
  // primitives don't accept a fluid width — we measure here and pass.
  useEffect(() => {
    const node = containerRef.current
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

  // Earliest cardio date in the dataset — drives the `All` preset bound. Falls
  // back to a fixed date so the picker is functional before any data loads.
  // Uses `parseSessionDate` so the local-day interpretation matches what
  // `filterStairSessions` will compare against later.
  const earliestDate = useMemo(() => {
    if (!data || data.sessions.length === 0) return EARLIEST_FALLBACK
    let earliestMs = Infinity
    for (const s of data.sessions) {
      const ms = parseSessionDate(s.date).getTime()
      if (Number.isFinite(ms) && ms < earliestMs) earliestMs = ms
    }
    return Number.isFinite(earliestMs) ? new Date(earliestMs) : EARLIEST_FALLBACK
  }, [data])

  // Re-anchor the active range to the dataset's earliest date once the data
  // arrives — otherwise an `All` preset locked to the fallback date wouldn't
  // include the real data when it's older. Only fires for the initial 1M
  // preset; user-selected ranges aren't overwritten.
  const anchoredRef = useRef(false)
  useEffect(() => {
    if (!data || anchoredRef.current) return
    setRange((prev) => {
      const next = rangeForPreset('1M', earliestDate)
      return prev.start.getTime() === next.start.getTime() &&
        prev.end.getTime() === next.end.getTime()
        ? prev
        : next
    })
    anchoredRef.current = true
  }, [data, earliestDate])

  const stairSessions = useMemo<CardioSession[]>(
    () => (data ? filterStairSessions(data.sessions, range) : []),
    [data, range],
  )
  const buckets = useMemo(() => aggregateHrZoneSeconds(stairSessions), [stairSessions])
  const avgHrPoints = useMemo(() => perSessionAvgHr(stairSessions), [stairSessions])

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
            Stair climber
          </div>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em] text-[#fff7ec] sm:text-5xl">
            Where the engine gets built
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Time-in-zone, per-session average heart rate, and the session log — all
            scoped to the date range. The stair climber is the primary Gym surface
            (PRD §7.4); treadmill and track detail views follow in Phase 3.
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
            <div ref={containerRef} className="mt-8 grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Time in zone"
                helper="Total minutes per HR zone across the filtered window."
              >
                <HrZoneBars
                  buckets={buckets}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fontFamily="'Patrick Hand', system-ui, sans-serif"
                />
              </ChartCard>

              <ChartCard
                title="Avg HR per session"
                helper="One bar per session — y-axis padded to the visible range so trends pop."
              >
                <AvgHrBars
                  points={avgHrPoints}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fontFamily="'Patrick Hand', system-ui, sans-serif"
                />
              </ChartCard>
            </div>

            <SessionLogTable sessions={stairSessions} range={range} />
          </>
        )}
      </div>
    </div>
  )
}

interface ChartCardProps {
  title: string
  helper: string
  children: JSX.Element
}

function ChartCard({ title, helper, children }: ChartCardProps): JSX.Element {
  return (
    <section
      className="rounded-[1.6rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_18px_46px_rgba(0,0,0,0.34)]"
    >
      <header className="mb-2 flex items-baseline justify-between gap-3">
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
  sessions: readonly CardioSession[]
  range: DateRange
}

function SessionLogTable({ sessions, range }: SessionLogTableProps): JSX.Element {
  // Show newest first in the table — opposite of charts. Tabular reading
  // convention is "what happened most recently?" at the top.
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
          No stair sessions in the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-separate border-spacing-y-1 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-white/55">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Duration
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
              {rows.map((s) => (
                <tr
                  key={`${s.date}-${s.duration_seconds}`}
                  className="rounded-md bg-white/5 align-middle"
                >
                  <td className="rounded-l-md px-3 py-2 font-mono">{formatRowDate(s.date)}</td>
                  <td className="px-3 py-2 font-mono">{formatDuration(s.duration_seconds)}</td>
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
  // Normalize to the same boundary the filter advertises so the readout
  // matches the picker's value, regardless of when the user clicked.
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
