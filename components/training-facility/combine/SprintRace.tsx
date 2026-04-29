'use client'

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useReducedMotion } from 'framer-motion'

import {
  HANDWRITING_FONT,
  SCENE_PALETTE,
} from '@/components/training-facility/scenes/scene-primitives'
import {
  RoughLineShape,
  RoughRect,
} from '@/components/training-facility/scenes/assets/rough-shapes'
import type { Benchmark } from '@/types/movement'

/** Props for {@link SprintRace}. */
export interface SprintRaceProps {
  /**
   * Benchmark history shared with the rest of the Combine page (typically
   * fed from `CombineDataIsland`). `undefined` while the initial fetch is
   * in flight; an empty array means no entries are logged.
   */
  entries: Benchmark[] | undefined
}

/**
 * One 10-yard sprint pulled from the benchmark history. Pairs the date with
 * the run time so the renderer can label and animate a lane without
 * re-looking-up the source benchmark.
 */
export interface SprintRun {
  /** ISO `YYYY-MM-DD` session date — primary key + toggle id. */
  date: string
  /** 10y sprint time in seconds. Determines the lane's real-time animation duration. */
  seconds: number
}

/**
 * Filter a benchmark history to runs that should appear as lanes in the race.
 * Skips entries without a sprint time and entries explicitly marked
 * `is_complete: false` (test/incomplete sessions per PRD §7.11) — they
 * shouldn't race against real efforts. Returns runs sorted ascending by
 * date so callers can index `runs[runs.length - 1]` to get "latest" with
 * the same semantics the Trading Card and Scoreboard already use.
 *
 * @param entries - Full benchmark history. May be empty or contain entries
 *   without sprint data; both are valid pre-baseline states.
 */
export function pickSprintRuns(entries: readonly Benchmark[]): SprintRun[] {
  const runs: SprintRun[] = []
  for (const entry of entries) {
    if (entry.is_complete === false) continue
    const seconds = entry.sprint_10y_s
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) continue
    runs.push({ date: entry.date, seconds })
  }
  runs.sort((a, b) => a.date.localeCompare(b.date))
  return runs
}

/**
 * Format an ISO `YYYY-MM-DD` date string as a short `Mon YYYY` chip label
 * (e.g. `2026-04-10` → `Apr 2026`). Parses the components manually so the
 * label doesn't drift across timezones — `new Date('2026-04-10')` is
 * UTC-midnight which can render as the previous day in negative offsets.
 *
 * Returns the original string unchanged when it isn't a recognisable
 * `YYYY-MM-DD`.
 */
export function formatSprintChipLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const monthIndex = Number.parseInt(match[2], 10) - 1
  if (monthIndex < 0 || monthIndex > 11) return date
  return `${MONTH_ABBR[monthIndex]} ${match[1]}`
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** ViewBox width — 10 yards at 50 viewBox units per yard, plus margins for start/finish chrome. */
const STRIP_W = 600
/** Inner-track left edge. Leaves room for the lane label on the left. */
const TRACK_X_LEFT = 70
/** Inner-track right edge. Leaves room for the finish-line time stamp on the right. */
const TRACK_X_RIGHT = 570
/** Width of the actual 10-yard track (start cone → finish line). */
const TRACK_W = TRACK_X_RIGHT - TRACK_X_LEFT
/** Per-yard tick spacing. */
const YARD_W = TRACK_W / 10
/** Vertical lane height. Tall enough for a dot + handwritten label without crowding. */
const LANE_H = 46
/** Vertical gap between the heading band and the first lane. */
const HEADER_H = 28
/** Vertical gap between the last lane and the bottom of the SVG. */
const FOOTER_H = 14

/**
 * Compute the dot's x-position for a lane at the elapsed time.
 * Linear interpolation along the track — sprint timing is dominated by
 * acceleration in the first ~3 yards in real life, but at this fidelity
 * (the only number that has to land exactly is the finish time) constant
 * velocity is the right call.
 *
 * Out-of-range elapsed times clamp to the start (`elapsed <= 0`) or
 * finish (`elapsed >= seconds`) edges. Reduced-motion callers pass
 * `elapsed = seconds` to snap immediately to the finish.
 *
 * @param elapsed - Time since the race started, in seconds.
 * @param seconds - This lane's total finish time.
 */
export function computeDotX(elapsed: number, seconds: number): number {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return TRACK_X_LEFT
  if (!Number.isFinite(seconds) || seconds <= 0) return TRACK_X_LEFT
  if (elapsed >= seconds) return TRACK_X_RIGHT
  return TRACK_X_LEFT + (elapsed / seconds) * TRACK_W
}

/**
 * Build the lane y-coordinates for each run, latest on top. The latest
 * entry occupies the topmost lane regardless of speed — the race is "this
 * month vs all my past selves," not a leaderboard.
 *
 * Returns one y per run in the same order the renderer iterates, so a
 * single helper keeps the dot, label, trail, and tooltip rectangle
 * synchronised.
 *
 * @param runs - Runs sorted ascending by date (as returned by
 *   {@link pickSprintRuns}).
 */
export function buildLaneYs(runs: readonly SprintRun[]): number[] {
  // Reverse-iterate so the most-recent run gets the smallest y (top of
  // the strip) without mutating the input array.
  const ys: number[] = []
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    ys[i] = HEADER_H + (runs.length - 1 - i) * LANE_H + LANE_H / 2
  }
  return ys
}

/**
 * Total SVG height for a race with `count` lanes. Exposed so the
 * containing `<svg>` can size itself to the run count instead of leaving
 * empty space when the user has only logged one or two sessions.
 */
export function svgHeight(count: number): number {
  if (count <= 0) return HEADER_H + FOOTER_H
  return HEADER_H + count * LANE_H + FOOTER_H
}

/**
 * Combine-page sprint race visualization (PRD §9.6).
 *
 * 10-yard horizontal strip styled as a track lane. One dot per logged
 * sprint, stacked vertically with the latest entry on top. Every dot
 * starts together and animates at its real time, so the latest run
 * pulls ahead and finishes first while older slower sprints are still
 * mid-track — the visual gap is the improvement.
 *
 * Renders nothing while the initial fetch is in flight (`entries`
 * undefined) or when no entry has a sprint time logged — the Scoreboard
 * already surfaces the empty state, duplicating it here would be noise.
 *
 * Reduced-motion preference snaps every enabled lane to its finished
 * state with no animation, so the spatial story (finish times, ordering)
 * survives even when motion is off.
 *
 * @param props.entries - Shared benchmark history. `undefined` ⇒ initial
 *   fetch in flight (renders nothing); `[]` or no sprint data ⇒ renders
 *   nothing; populated ⇒ animates one lane per qualifying entry.
 */
export function SprintRace({ entries }: SprintRaceProps): JSX.Element | null {
  const runs = useMemo(() => (entries ? pickSprintRuns(entries) : []), [entries])
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(() => new Set())
  const knownDatesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const currentDates = new Set(runs.map((r) => r.date))
    setEnabled((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const date of currentDates) {
        if (!knownDatesRef.current.has(date)) {
          if (!next.has(date)) {
            next.add(date)
            changed = true
          }
        }
      }
      for (const date of prev) {
        if (!currentDates.has(date)) {
          next.delete(date)
          changed = true
        }
      }
      knownDatesRef.current = currentDates
      return changed ? next : prev
    })
  }, [runs])

  const [replayKey, setReplayKey] = useState(0)
  const reducedMotion = useReducedMotion()

  if (!entries || runs.length === 0) return null

  return (
    <section
      aria-label="10-yard sprint race vs past selves"
      className="flex flex-col items-center gap-4"
    >
      <SprintTrackSvg
        runs={runs}
        enabled={enabled}
        replayKey={replayKey}
        reducedMotion={reducedMotion === true}
      />
      <SprintControls
        runs={runs}
        enabled={enabled}
        onToggle={(date) =>
          setEnabled((prev) => {
            const next = new Set(prev)
            if (next.has(date)) next.delete(date)
            else next.add(date)
            return next
          })
        }
        onRace={() => setReplayKey((k) => k + 1)}
      />
    </section>
  )
}

interface SprintTrackSvgProps {
  runs: readonly SprintRun[]
  enabled: ReadonlySet<string>
  replayKey: number
  reducedMotion: boolean
}

function SprintTrackSvg({
  runs,
  enabled,
  replayKey,
  reducedMotion,
}: SprintTrackSvgProps): JSX.Element {
  // Resolve "latest" against the enabled subset so toggling off the
  // newest run promotes the next-most-recent visible lane to the
  // rim-orange highlight. Always feed the elapsed hook the full `runs`
  // list, though — sourcing maxSeconds from the filtered subset would
  // shorten the race when a slow lane is toggled off, which fires the
  // hook's restart effect and visibly rewinds the clock mid-race.
  const latestEnabledDate = runs
    .filter((r) => enabled.has(r.date))
    .reduce<string | undefined>(
      (acc, r) => (acc === undefined || r.date > acc ? r.date : acc),
      undefined,
    )
  const elapsed = useSprintElapsed({ runs, replayKey, reducedMotion })
  const laneYs = buildLaneYs(runs)
  const height = svgHeight(runs.length)

  return (
    <svg
      viewBox={`0 0 ${STRIP_W} ${height}`}
      role="img"
      aria-label="10-yard sprint lane with one animated dot per logged session, latest run on top"
      className="w-full max-w-3xl rounded-lg shadow-[0_18px_36px_-20px_rgba(0,0,0,0.55)]"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="sprint-track" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a120a" />
          <stop offset="55%" stopColor="#241811" />
          <stop offset="100%" stopColor="#0f0907" />
        </linearGradient>
        <filter id="sprint-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* Track surface */}
      <rect x={0} y={0} width={STRIP_W} height={height} fill="url(#sprint-track)" />

      <TrackChrome height={height} laneYs={laneYs} runCount={runs.length} />

      {runs.map((run, i) => {
        if (!enabled.has(run.date)) return null
        const isLatest = run.date === latestEnabledDate
        const progressSeconds = reducedMotion ? run.seconds : elapsed
        return (
          <SprintLane
            key={`${run.date}-${replayKey}`}
            run={run}
            laneY={laneYs[i]}
            elapsedSeconds={progressSeconds}
            isLatest={isLatest}
          />
        )
      })}
    </svg>
  )
}

interface TrackChromeProps {
  height: number
  laneYs: readonly number[]
  runCount: number
}

function TrackChrome({ height, laneYs, runCount }: TrackChromeProps): JSX.Element {
  return (
    <g aria-hidden="true">
      {/* Outer hand-drawn frame */}
      <RoughRect
        x={6}
        y={6}
        width={STRIP_W - 12}
        height={height - 12}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.1}
        seed={601}
      />

      {/* Distance label (start) */}
      <text
        x={TRACK_X_LEFT}
        y={20}
        fill={SCENE_PALETTE.creamBright}
        fontFamily={HANDWRITING_FONT}
        fontSize={14}
        textAnchor="middle"
        opacity={0.85}
      >
        START
      </text>
      {/* Distance label (finish) */}
      <text
        x={TRACK_X_RIGHT}
        y={20}
        fill={SCENE_PALETTE.rim}
        fontFamily={HANDWRITING_FONT}
        fontSize={14}
        textAnchor="middle"
      >
        10y
      </text>

      {/* Lane separators between rows */}
      {Array.from({ length: Math.max(0, runCount - 1) }, (_, i) => {
        const y = HEADER_H + (i + 1) * LANE_H
        return (
          <line
            key={`lane-sep-${i}`}
            x1={TRACK_X_LEFT - 10}
            y1={y}
            x2={TRACK_X_RIGHT + 10}
            y2={y}
            stroke={SCENE_PALETTE.cream}
            strokeOpacity={0.12}
            strokeWidth={1}
            strokeDasharray="2 5"
          />
        )
      })}

      {/* Yard tick marks — every yard, full-height ghost lines plus a stronger tick at the lane row */}
      {Array.from({ length: 11 }, (_, i) => {
        const x = TRACK_X_LEFT + i * YARD_W
        const isMajor = i === 0 || i === 5 || i === 10
        return (
          <g key={`tick-${i}`}>
            <line
              x1={x}
              y1={HEADER_H - 4}
              x2={x}
              y2={height - FOOTER_H}
              stroke={SCENE_PALETTE.cream}
              strokeOpacity={isMajor ? 0.22 : 0.08}
              strokeWidth={1}
            />
            {/* Yard number under the strip — only for 0 / 5 / 10 to keep it readable */}
            {isMajor && laneYs.length > 0 && (
              <text
                x={x}
                y={height - 2}
                fill={SCENE_PALETTE.cream}
                fontFamily={HANDWRITING_FONT}
                fontSize={10}
                textAnchor="middle"
                opacity={0.55}
              >
                {`${i}y`}
              </text>
            )}
          </g>
        )
      })}

      {/* Start line — solid rim-orange marker */}
      <RoughLineShape
        x1={TRACK_X_LEFT}
        y1={HEADER_H - 4}
        x2={TRACK_X_LEFT}
        y2={height - FOOTER_H}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2}
        roughness={0.6}
        seed={602}
      />

      {/* Finish line — checkered band */}
      <FinishLine height={height} />
    </g>
  )
}

interface FinishLineProps {
  height: number
}

function FinishLine({ height }: FinishLineProps): JSX.Element {
  // Two-row checker pattern centered on the finish-line x. Cells are 6
  // viewBox units tall — small enough to read as a checker even on
  // short single-lane strips.
  const cellH = 6
  const cellW = 6
  const top = HEADER_H - 4
  const bottom = height - FOOTER_H
  const rows = Math.max(2, Math.floor((bottom - top) / cellH))
  const cells: JSX.Element[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      const filled = (r + c) % 2 === 0
      cells.push(
        <rect
          key={`fin-${r}-${c}`}
          x={TRACK_X_RIGHT - cellW + c * cellW}
          y={top + r * cellH}
          width={cellW}
          height={cellH}
          fill={filled ? SCENE_PALETTE.creamBright : SCENE_PALETTE.ink}
        />,
      )
    }
  }
  return <g aria-hidden="true">{cells}</g>
}

interface SprintLaneProps {
  run: SprintRun
  laneY: number
  elapsedSeconds: number
  isLatest: boolean
}

function SprintLane({ run, laneY, elapsedSeconds, isLatest }: SprintLaneProps): JSX.Element {
  const finished = elapsedSeconds >= run.seconds
  const dotX = computeDotX(elapsedSeconds, run.seconds)
  const stroke = isLatest ? SCENE_PALETTE.rim : SCENE_PALETTE.creamBright
  const dotR = isLatest ? 8 : 6
  const trailOpacity = isLatest ? 0.6 : 0.22
  const labelOpacity = isLatest ? 0.95 : 0.55
  const label = formatSprintChipLabel(run.date)
  // A finish stamp sits to the right of the finish line once the dot
  // crosses it. Reads `1.91s` in handwriting font.
  const stampX = TRACK_X_RIGHT + 4
  const stampOpacity = finished ? 1 : 0

  return (
    <g>
      {/* Lane label on the left edge — a date chip so users can identify the lane without hovering */}
      <text
        x={TRACK_X_LEFT - 14}
        y={laneY + 4}
        fill={stroke}
        fillOpacity={labelOpacity}
        fontFamily={HANDWRITING_FONT}
        fontSize={13}
        textAnchor="end"
      >
        {label}
      </text>

      {/* Trail behind the dot — a faded line from start to current x */}
      <line
        x1={TRACK_X_LEFT}
        y1={laneY}
        x2={dotX}
        y2={laneY}
        stroke={stroke}
        strokeOpacity={trailOpacity}
        strokeWidth={isLatest ? 4 : 2.5}
        strokeLinecap="round"
      />

      {/* Glow layer behind the latest dot */}
      {isLatest && !finished && (
        <circle
          cx={dotX}
          cy={laneY}
          r={dotR + 4}
          fill={stroke}
          fillOpacity={0.35}
          filter="url(#sprint-glow)"
        />
      )}

      {/* The runner's dot */}
      <circle cx={dotX} cy={laneY} r={dotR} fill={stroke} fillOpacity={isLatest ? 1 : 0.8}>
        <title>{`${run.date} — ${run.seconds.toFixed(2)}s`}</title>
      </circle>

      {/* Hover hit area — a wide invisible rect across the full lane so
          the title tooltip works anywhere on the row, not just on the dot. */}
      <rect
        x={TRACK_X_LEFT - 60}
        y={laneY - LANE_H / 2 + 2}
        width={STRIP_W - (TRACK_X_LEFT - 60)}
        height={LANE_H - 4}
        fill="transparent"
      >
        <title>{`${run.date} — ${run.seconds.toFixed(2)}s`}</title>
      </rect>

      {/* Finish-line time stamp — appears at the moment the dot crosses */}
      <text
        x={stampX}
        y={laneY + 4}
        fill={stroke}
        fillOpacity={stampOpacity}
        fontFamily={HANDWRITING_FONT}
        fontSize={isLatest ? 14 : 12}
        textAnchor="start"
        style={{ transition: 'fill-opacity 220ms ease-out' }}
      >
        {`${run.seconds.toFixed(2)}s`}
      </text>
    </g>
  )
}

interface UseSprintElapsedArgs {
  runs: readonly SprintRun[]
  replayKey: number
  reducedMotion: boolean
}

/**
 * Drives a `requestAnimationFrame` loop that exposes "seconds since the
 * latest race started" to the renderer. Stops the loop once every lane
 * has finished so the component isn't re-rendering 60 times a second
 * forever after the last dot lands. Replaying restarts the clock by
 * resetting on `replayKey` change.
 */
function useSprintElapsed({ runs, replayKey, reducedMotion }: UseSprintElapsedArgs): number {
  const [elapsed, setElapsed] = useState(0)
  const maxSeconds = useMemo(
    () => runs.reduce((acc, r) => Math.max(acc, r.seconds), 0),
    [runs],
  )

  useEffect(() => {
    if (reducedMotion || maxSeconds <= 0) {
      setElapsed(maxSeconds)
      return
    }
    setElapsed(0)
    const start = performance.now()
    let raf = 0
    let cancelled = false
    const tick = (now: number): void => {
      if (cancelled) return
      const seconds = (now - start) / 1000
      if (seconds >= maxSeconds) {
        setElapsed(maxSeconds)
        return
      }
      setElapsed(seconds)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [maxSeconds, replayKey, reducedMotion])

  return elapsed
}

interface SprintControlsProps {
  runs: readonly SprintRun[]
  enabled: ReadonlySet<string>
  onToggle: (date: string) => void
  onRace: () => void
}

function SprintControls({
  runs,
  enabled,
  onToggle,
  onRace,
}: SprintControlsProps): JSX.Element {
  return (
    <div className="flex w-full max-w-3xl flex-wrap items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={onRace}
        className="rounded-full border-2 border-[#0f0907] bg-[#ea580c] px-4 py-1.5 font-handwriting text-base text-[#0f0907] shadow-[2px_2px_0_#0f0907] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        Race
      </button>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {runs.map((run) => {
          const active = enabled.has(run.date)
          return (
            <SprintToggleChip
              key={run.date}
              run={run}
              active={active}
              onToggle={() => onToggle(run.date)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface SprintToggleChipProps {
  run: SprintRun
  active: boolean
  onToggle: () => void
}

function SprintToggleChip({ run, active, onToggle }: SprintToggleChipProps): JSX.Element {
  const label = formatSprintChipLabel(run.date)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${label} — ${run.seconds.toFixed(2)}s sprint`}
      onClick={onToggle}
      className={
        active
          ? 'rounded-full border-2 border-[#0f0907] bg-[#f7ead9] px-3 py-1 font-handwriting text-[#0f0907] shadow-[2px_2px_0_#0f0907]'
          : 'rounded-full border-2 border-dashed border-[#0f0907]/50 bg-transparent px-3 py-1 font-handwriting text-[#0f0907]/50'
      }
    >
      <span
        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
        style={{ backgroundColor: active ? SCENE_PALETTE.rim : 'transparent' }}
      />
      <span>{label}</span>
      <span className="ml-1 opacity-70">· {run.seconds.toFixed(2)}s</span>
    </button>
  )
}
