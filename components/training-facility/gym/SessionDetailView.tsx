'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'

import type { CardioSession, HrSample } from '@/types/cardio'
import { aggregateHrZoneSeconds, formatDuration, parseSessionDate } from '@/lib/training-facility/cardio-shared'
import { ACTIVITY_VISUALS } from '@/lib/training-facility/all-cardio'
import { METERS_PER_MILE } from '@/lib/training-facility/running'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { RoughLine } from '@/components/training-facility/shared/charts/RoughLine'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import { defaultMargin } from '@/components/training-facility/shared/charts/types'
import { HrZoneBars } from './HrZoneBars'

const CURVE_HEIGHT = 320
const ZONE_HEIGHT = 280
const MIN_CHART_WIDTH = 280
const DEFAULT_CHART_WIDTH = 880
const FONT_FAMILY = "'Patrick Hand', system-ui, sans-serif"

/** Single point on the HR curve — `{ tSeconds, bpm }`. */
interface CurvePoint {
  /** Seconds since session start. The x-axis renders these as `M:SS`. */
  tSeconds: number
  /** Heart rate in BPM at this sample. */
  bpm: number
}

/** Props for {@link SessionDetailView}. */
export interface SessionDetailViewProps {
  /** The session payload (header metadata, zone breakdown). */
  session: CardioSession
  /** Raw HR samples for the session, oldest → newest. May be empty. */
  samples: readonly HrSample[]
}

/**
 * Per-session detail view (#165) — header with session metadata, an HR
 * curve over session-relative time, and the existing five-zone bars.
 *
 * Mounted as a client component because the chart width tracks the
 * card's actual rendered width via {@link ResizeObserver} (the shared
 * chart primitives don't accept a fluid `100%` width). The data itself
 * is read by the Server Component parent and passed down — this view
 * does no fetching of its own.
 */
export function SessionDetailView({
  session,
  samples,
}: SessionDetailViewProps): JSX.Element {
  const curveSizerRef = useRef<HTMLDivElement>(null)
  const zoneSizerRef = useRef<HTMLDivElement>(null)
  const [curveWidth, setCurveWidth] = useState(DEFAULT_CHART_WIDTH)
  const [zoneWidth, setZoneWidth] = useState(DEFAULT_CHART_WIDTH)

  useEffect(() => {
    const node = curveSizerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(MIN_CHART_WIDTH, Math.floor(entry.contentRect.width))
        setCurveWidth((prev) => (prev === next ? prev : next))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = zoneSizerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(MIN_CHART_WIDTH, Math.floor(entry.contentRect.width))
        setZoneWidth((prev) => (prev === next ? prev : next))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const sessionStartMs = useMemo(() => {
    const dt = parseSessionDate(session.date)
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0
  }, [session.date])

  // Convert raw samples to session-relative seconds. PostgREST orders the
  // samples ascending so this stays sorted for the line chart.
  const curve = useMemo<CurvePoint[]>(() => {
    if (sessionStartMs === 0) return []
    return samples.map((s) => {
      const sampleMs = new Date(s.ts).getTime()
      const tSeconds = Number.isFinite(sampleMs)
        ? Math.max(0, (sampleMs - sessionStartMs) / 1000)
        : 0
      return { tSeconds, bpm: s.bpm }
    })
  }, [samples, sessionStartMs])

  // Reuse the same HrZoneBucket aggregation that powers the inline strip
  // (#163) and the click-to-expand panel (#164) — the detail page just
  // gets a bigger version of the same chart.
  const buckets = useMemo(() => aggregateHrZoneSeconds([session]), [session])

  const visual = ACTIVITY_VISUALS[session.activity]
  const dateLabel = formatHeaderDate(session.date)
  const durationLabel = formatDuration(session.duration_seconds)
  const distanceLabel = formatDistanceMiles(session.distance_meters)
  const avgHrLabel = typeof session.avg_hr === 'number' ? `${Math.round(session.avg_hr)} BPM` : '—'
  const maxHrLabel = typeof session.max_hr === 'number' ? `${Math.round(session.max_hr)} BPM` : '—'

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
            href="/training-facility/gym/overview"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← All cardio
          </Link>
        </div>

        <header className="mt-12">
          <div className="text-xs font-semibold uppercase tracking-[0.38em] text-white/60">
            Session detail
          </div>
          <h1 className="mt-3 flex flex-wrap items-baseline gap-3 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-4xl">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: visual.color }}
            />
            {visual.label} — {dateLabel}
          </h1>
        </header>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Duration" value={durationLabel} />
          <Stat label="Distance" value={distanceLabel} />
          <Stat label="Avg HR" value={avgHrLabel} />
          <Stat label="Max HR" value={maxHrLabel} />
        </dl>

        <ChartCard
          title="Heart-rate curve"
          helper="One sample every ~5s during the workout. Time runs left → right; gaps in the line mean the watch dropped readings."
        >
          <div ref={curveSizerRef}>
            {curve.length === 0 ? (
              <EmptyHrCurve width={curveWidth} />
            ) : (
              <RoughLine
                data={curve}
                x={(d) => d.tSeconds}
                y={(d) => d.bpm}
                width={curveWidth}
                height={CURVE_HEIGHT}
                margin={defaultMargin}
                fontFamily={FONT_FAMILY}
                axisColor={chartPalette.inkBlack}
                showDots={false}
                stroke={chartPalette.rimOrange}
                xLabel="Time"
                yLabel="BPM"
                xTickFormat={formatCurveTime}
                ariaLabel={`Heart-rate curve for ${visual.label} session on ${dateLabel}`}
              />
            )}
          </div>
        </ChartCard>

        <ChartCard
          title="Time in zone"
          helper="Same Z1–Z5 breakdown as the dashboard — scoped to this single session."
        >
          <div ref={zoneSizerRef}>
            <HrZoneBars
              buckets={buckets}
              width={zoneWidth}
              height={ZONE_HEIGHT}
              fontFamily={FONT_FAMILY}
            />
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

interface StatProps {
  label: string
  value: string
}

/** Single stat card in the header metadata row — same visual weight as the dashboard summary cards. */
function Stat({ label, value }: StatProps): JSX.Element {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-4 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/70">
        {label}
      </h3>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0a0a0a]">{value}</p>
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
    <section className="mt-6 rounded-[1.6rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
      <header className="mb-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#0a0a0a]">
          {title}
        </h2>
      </header>
      <p className="mb-4 text-xs leading-5 text-[#404040]">{helper}</p>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

/**
 * Empty-state card shown when a session has no HR samples (Apple Watch
 * was off). Same canvas dimensions as the populated curve so the layout
 * doesn't shift between data and no-data sessions.
 */
function EmptyHrCurve({ width }: { width: number }): JSX.Element {
  return (
    <div
      style={{ width, height: CURVE_HEIGHT }}
      className="flex items-center justify-center text-sm text-[#404040]"
    >
      No HR samples recorded for this session.
    </div>
  )
}

/**
 * Format a session date for the page header — `Apr 26, 2026 · 8:00 AM`.
 * Falls back to the raw string if Date parsing fails so a malformed
 * timestamp doesn't render as `Invalid Date`.
 */
function formatHeaderDate(raw: string): string {
  const dt = parseSessionDate(raw)
  if (!Number.isFinite(dt.getTime())) return raw
  const date = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

/**
 * Format `distance_meters` as `M.M mi` for the header metadata row,
 * `—` for the no-distance case (stair sessions, Apple Watch dropped GPS).
 */
function formatDistanceMiles(meters: number | undefined): string {
  if (typeof meters !== 'number' || meters <= 0) return '—'
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`
}

/**
 * Format an HR-curve x-axis tick (session-relative seconds) as `M:SS`.
 * Crosses the hour boundary as `H:MM:SS`. Used by `RoughLine`'s
 * `xTickFormat` so the axis reads as "minute 8 of the workout" rather
 * than "480 seconds since session start."
 */
function formatCurveTime(value: number | Date): string {
  const seconds = typeof value === 'number' ? value : value.getTime() / 1000
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}
