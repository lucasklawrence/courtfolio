'use client'

import { useEffect, useMemo, useState, type CSSProperties, type JSX } from 'react'
import { useReducedMotion } from 'framer-motion'

import {
  HANDWRITING_FONT,
  SCENE_PALETTE,
} from '@/components/training-facility/scenes/scene-primitives'
import {
  RoughCircle,
  RoughLineShape,
  RoughPath,
  RoughPolygon,
  RoughRect,
} from '@/components/training-facility/scenes/assets/rough-shapes'
import type { Benchmark } from '@/types/movement'

/**
 * Props for {@link ShuttleTrace}.
 */
export interface ShuttleTraceProps {
  /**
   * Benchmark history shared with the rest of the Combine page (typically
   * fed from {@link CombineDataIsland}). `undefined` while the initial
   * fetch is in flight; an empty array means no entries are logged.
   */
  entries: Benchmark[] | undefined
}

/**
 * One shuttle run picked from the benchmark history. Keeps `date` and
 * `seconds` together so the renderer never has to re-look-up the source
 * benchmark to label or animate a trace.
 */
export interface ShuttleRun {
  /** ISO `YYYY-MM-DD` date of the benchmark session — primary key + toggle id. */
  date: string
  /** 5-10-5 shuttle time in seconds. Determines real-time animation duration. */
  seconds: number
}

/**
 * Filter a benchmark history to runs that should be drawn on the court.
 * Skips entries without a shuttle time and entries explicitly marked
 * `is_complete: false` (test/incomplete sessions per PRD §7.11) — they
 * shouldn't race against real efforts. Returns runs sorted ascending by
 * date so callers can index `runs[runs.length - 1]` to get "latest" with
 * the same semantics the Trading Card and Scoreboard already use.
 *
 * @param entries - Full benchmark history. May be empty or contain entries
 *   without shuttle data; both are valid pre-baseline states.
 */
export function pickShuttleRuns(entries: readonly Benchmark[]): ShuttleRun[] {
  const runs: ShuttleRun[] = []
  for (const entry of entries) {
    if (entry.is_complete === false) continue
    const seconds = entry.shuttle_5_10_5_s
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
 * `YYYY-MM-DD`, which is enough to keep the chip readable without
 * masking malformed data.
 */
export function formatShuttleChipLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const monthIndex = Number.parseInt(match[2], 10) - 1
  if (monthIndex < 0 || monthIndex > 11) return date
  return `${MONTH_ABBR[monthIndex]} ${match[1]}`
}

/**
 * Three-letter month abbreviations indexed `0…11` so `formatShuttleChipLabel`
 * can convert an ISO month component (`'04'` → `3` → `'Apr'`) without
 * spinning up `Intl.DateTimeFormat` for a chip-sized label.
 */
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** ViewBox width — 50 ft wide half-court at 10 viewBox units per foot. */
const COURT_W = 500
/** ViewBox height — 47 ft (NBA half-court depth) at 10 units per foot. */
const COURT_H = 470
/** Hoop center x (half-court is symmetric). */
const HOOP_X = COURT_W / 2
/** Hoop center y — ~5.3 ft from baseline (rim center past the backboard). */
const HOOP_Y = 53
/** Lane (key) inner-left x. Lane is 16 ft wide centered on the hoop. */
const LANE_X_LEFT = HOOP_X - 80
/** Lane inner-right x. */
const LANE_X_RIGHT = HOOP_X + 80
/** Free-throw line y — 19 ft from baseline. */
const FT_LINE_Y = 190
/** Free-throw circle radius — 6 ft. */
const FT_CIRCLE_R = 60
/** Three-point arc radius from hoop center — 23'9". */
const THREE_PT_R = 237.5
/** Three-point straight-corner x (left side) — 22 ft from hoop horizontally. */
const THREE_PT_X_LEFT = HOOP_X - 220
/** Three-point straight-corner x (right side). */
const THREE_PT_X_RIGHT = HOOP_X + 220
/**
 * Y at which the three-point arc meets the corner straights. Solved from
 * `(x - HOOP_X)^2 + (y - HOOP_Y)^2 = THREE_PT_R^2` with `x = THREE_PT_X_LEFT`.
 */
const THREE_PT_CORNER_Y = HOOP_Y + Math.sqrt(THREE_PT_R * THREE_PT_R - 220 * 220)

/** Cone-row y — placed past the apex of the free-throw circle, "top of the key". */
const CONE_Y = 260
/** Center cone x (the shuttle's start/finish post). */
const CONE_CENTER_X = HOOP_X
/** 5 yards = 15 ft = 150 viewBox units between adjacent cones. */
const CONE_SPACING = 150
/** Far-left cone x — the second touch in the 5-10-5 sequence. */
const CONE_LEFT_X = CONE_CENTER_X - CONE_SPACING
/** Right cone x — the first touch out of the gate. */
const CONE_RIGHT_X = CONE_CENTER_X + CONE_SPACING

/**
 * Three anchor points the shuttle path threads between: center → right →
 * far-left → center. Centralising the geometry keeps the renderer and the
 * `computeShuttlePosition` helper consistent (and lets a single test pin
 * both surfaces against the same coordinates).
 */
export interface ShuttleGeometry {
  /** Start/finish cone — the runner's "middle" cone. */
  center: { x: number; y: number }
  /** First touch — 5 yards from center. */
  right: { x: number; y: number }
  /** Second touch — 10 yards from the right cone (i.e. 5 yards beyond center). */
  left: { x: number; y: number }
}

/** Default cone geometry derived from the court constants. */
export const SHUTTLE_GEOMETRY: ShuttleGeometry = {
  center: { x: CONE_CENTER_X, y: CONE_Y },
  right: { x: CONE_RIGHT_X, y: CONE_Y },
  left: { x: CONE_LEFT_X, y: CONE_Y },
}

/**
 * Position along the 5-10-5 path at fractional progress `t ∈ [0, 1]`.
 *
 * The shuttle has three legs whose distances are 5y / 10y / 5y, so under a
 * constant-velocity assumption (good enough at this fidelity — a real run
 * decelerates at each cone, but for a "race the past" silhouette the
 * total finish time is the only number that has to land exactly) each
 * leg consumes its share of `t`: 0–0.25 right, 0.25–0.75 cross, 0.75–1
 * back to center.
 *
 * Out-of-range `t` clamps to the start (`t ≤ 0`) or finish (`t ≥ 1`)
 * cone — the renderer relies on this when an entry has already finished
 * its animation but the rAF loop is still running for a slower entry.
 *
 * @param t - Progress along the run, 0 = start, 1 = finish.
 * @param geom - Cone geometry to interpolate between. Defaults to
 *   {@link SHUTTLE_GEOMETRY}.
 */
export function computeShuttlePosition(
  t: number,
  geom: ShuttleGeometry = SHUTTLE_GEOMETRY,
): { x: number; y: number } {
  if (t <= 0) return { ...geom.center }
  if (t >= 1) return { ...geom.center }
  if (t <= 0.25) return lerpPoint(geom.center, geom.right, t / 0.25)
  if (t <= 0.75) return lerpPoint(geom.right, geom.left, (t - 0.25) / 0.5)
  return lerpPoint(geom.left, geom.center, (t - 0.75) / 0.25)
}

function lerpPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * Build the polyline points for a shuttle trail at fractional progress
 * `t`. Always starts at the center cone and ends at the dot's current
 * position; intermediate cone touches are pushed once the runner has
 * passed them so the trail bends at each cone instead of drawing a
 * straight diagonal across the court.
 *
 * Returned as an SVG `points` string suitable for `<polyline points={…}>`.
 *
 * @param t - Progress along the run, 0 = start, 1 = finish (clamped).
 * @param geom - Cone geometry. Defaults to {@link SHUTTLE_GEOMETRY}.
 */
export function buildTrailPath(
  t: number,
  geom: ShuttleGeometry = SHUTTLE_GEOMETRY,
): string {
  const points: Array<{ x: number; y: number }> = [geom.center]
  if (t >= 0.25) points.push(geom.right)
  if (t >= 0.75) points.push(geom.left)
  if (t >= 1) points.push(geom.center)
  if (t > 0 && t < 1) {
    // Skip pushing the live dot when it lands exactly on the cone we
    // just touched (t === 0.25 / 0.75) — otherwise the polyline would
    // render a redundant duplicate point at the transition.
    const dot = computeShuttlePosition(t, geom)
    const last = points[points.length - 1]
    if (dot.x !== last.x || dot.y !== last.y) points.push(dot)
  }
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/**
 * Combine-page shuttle trace visualization (PRD §9.5).
 *
 * Top-down half-court SVG with each monthly 5-10-5 run animated as a
 * separate trace at its real-time pace. Latest run renders solid in
 * rim-orange; prior runs render as faded ghost trails behind. All
 * traces start together — the visual gap when the latest finishes
 * first while older slower runs are still mid-court is the improvement.
 *
 * Renders nothing while the initial fetch is in flight (`entries`
 * undefined) or when no run has a shuttle time logged — the Scoreboard
 * already surfaces the empty state, duplicating it here would be noise.
 *
 * Reduced-motion preference snaps every enabled trace to its finished
 * state with no animation, so the spatial story (cones touched, path
 * shape) survives even when motion is off.
 *
 * @param props.entries - Shared benchmark history. `undefined` ⇒ initial
 *   fetch in flight (renders nothing); `[]` or no shuttle data ⇒ renders
 *   nothing; populated ⇒ animates one trace per qualifying entry.
 */
export function ShuttleTrace({ entries }: ShuttleTraceProps): JSX.Element | null {
  const runs = useMemo(() => (entries ? pickShuttleRuns(entries) : []), [entries])
  // Tracking the *disabled* subset (not the enabled one) lets us derive
  // `enabled` synchronously from `runs` on every render — no post-mount
  // effect, no first-paint flash where every chip briefly reads as off.
  // It also makes the "preserve user toggles across refetches" rule
  // automatic: a brand-new entry isn't in `userDisabled`, so it appears
  // visible by default; a deleted entry simply stops appearing in
  // `runs` and drops from `enabled` even if its date lingers in the
  // disabled set.
  const [userDisabled, setUserDisabled] = useState<ReadonlySet<string>>(() => new Set())
  const enabled = useMemo<ReadonlySet<string>>(
    () => {
      const set = new Set<string>()
      for (const run of runs) {
        if (!userDisabled.has(run.date)) set.add(run.date)
      }
      return set
    },
    [runs, userDisabled],
  )

  const [replayKey, setReplayKey] = useState(0)
  const reducedMotion = useReducedMotion()

  if (!entries || runs.length === 0) return null

  return (
    <section
      aria-label="5-10-5 shuttle trace on the court"
      className="flex flex-col items-center gap-4"
    >
      <ShuttleCourtSvg
        runs={runs}
        enabled={enabled}
        replayKey={replayKey}
        reducedMotion={reducedMotion === true}
      />
      <ShuttleControls
        runs={runs}
        enabled={enabled}
        onToggle={(date) =>
          setUserDisabled((prev) => {
            const next = new Set(prev)
            if (next.has(date)) next.delete(date)
            else next.add(date)
            return next
          })
        }
        onReplay={() => setReplayKey((k) => k + 1)}
      />
    </section>
  )
}

interface ShuttleCourtSvgProps {
  runs: readonly ShuttleRun[]
  enabled: ReadonlySet<string>
  replayKey: number
  reducedMotion: boolean
}

function ShuttleCourtSvg({
  runs,
  enabled,
  replayKey,
  reducedMotion,
}: ShuttleCourtSvgProps): JSX.Element {
  // The latest enabled run drives "solid rim-orange"; older enabled runs
  // are ghost trails. We resolve "latest" against the *enabled* subset so
  // toggling off this month's run promotes March to the highlighted role
  // and the scene still has a hero trace to draw the eye.
  const latestEnabledDate = runs
    .filter((r) => enabled.has(r.date))
    .reduce<string | undefined>(
      (acc, r) => (acc === undefined || r.date > acc ? r.date : acc),
      undefined,
    )

  // Animation envelope is sized to the slowest *enabled* run — so
  // toggling off a slow ghost trail also shortens how long the rAF loop
  // burns frames.
  const enabledMaxSeconds = useMemo(
    () =>
      runs.reduce(
        (acc, r) => (enabled.has(r.date) ? Math.max(acc, r.seconds) : acc),
        0,
      ),
    [runs, enabled],
  )
  const elapsed = useShuttleElapsed({
    maxSeconds: enabledMaxSeconds,
    replayKey,
    reducedMotion,
  })

  return (
    <svg
      viewBox={`0 0 ${COURT_W} ${COURT_H}`}
      role="img"
      aria-label="Half-court diagram showing the 5-10-5 shuttle path animated for each logged run"
      className="w-full max-w-2xl rounded-lg shadow-[0_18px_36px_-20px_rgba(0,0,0,0.55)]"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="shuttle-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SCENE_PALETTE.hardwoodLight} />
          <stop offset="55%" stopColor={SCENE_PALETTE.hardwoodMid} />
          <stop offset="100%" stopColor={SCENE_PALETTE.hardwoodDark} />
        </linearGradient>
        <filter id="shuttle-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* Hardwood floor + sideline frame */}
      <rect x={0} y={0} width={COURT_W} height={COURT_H} fill="url(#shuttle-floor)" />
      <RoughRect
        x={6}
        y={6}
        width={COURT_W - 12}
        height={COURT_H - 12}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={3}
        roughness={1.2}
        seed={701}
      />

      <CourtMarkings />
      <ConeMarkers />

      {runs.map((run) => {
        if (!enabled.has(run.date)) return null
        const isLatest = run.date === latestEnabledDate
        const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, elapsed / run.seconds))
        return (
          <ShuttleRunTrace
            key={`${run.date}-${replayKey}`}
            run={run}
            progress={progress}
            isLatest={isLatest}
          />
        )
      })}
    </svg>
  )
}

function CourtMarkings(): JSX.Element {
  return (
    <g aria-hidden="true">
      {/* Half-court line (bottom edge of the half-court view) */}
      <RoughLineShape
        x1={6}
        y1={COURT_H - 6}
        x2={COURT_W - 6}
        y2={COURT_H - 6}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={3}
        roughness={1.0}
        seed={702}
      />
      {/* Lane (key) outline */}
      <RoughRect
        x={LANE_X_LEFT}
        y={6}
        width={LANE_X_RIGHT - LANE_X_LEFT}
        height={FT_LINE_Y - 6}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.1}
        seed={703}
      />
      {/* Free-throw line */}
      <RoughLineShape
        x1={LANE_X_LEFT}
        y1={FT_LINE_Y}
        x2={LANE_X_RIGHT}
        y2={FT_LINE_Y}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.0}
        seed={704}
      />
      {/* Free-throw arc — semicircle opening toward the half-court line */}
      <RoughPath
        d={`M ${HOOP_X - FT_CIRCLE_R} ${FT_LINE_Y} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 0 ${HOOP_X + FT_CIRCLE_R} ${FT_LINE_Y}`}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.1}
        seed={705}
      />
      {/* Three-point line — straight corners + arc */}
      <RoughLineShape
        x1={THREE_PT_X_LEFT}
        y1={6}
        x2={THREE_PT_X_LEFT}
        y2={THREE_PT_CORNER_Y}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.0}
        seed={706}
      />
      <RoughLineShape
        x1={THREE_PT_X_RIGHT}
        y1={6}
        x2={THREE_PT_X_RIGHT}
        y2={THREE_PT_CORNER_Y}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.0}
        seed={707}
      />
      <RoughPath
        d={`M ${THREE_PT_X_LEFT} ${THREE_PT_CORNER_Y} A ${THREE_PT_R} ${THREE_PT_R} 0 0 0 ${THREE_PT_X_RIGHT} ${THREE_PT_CORNER_Y}`}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.0}
        seed={708}
      />
      {/* Hoop / backboard — small touch so the basket is recognisable */}
      <RoughLineShape
        x1={HOOP_X - 30}
        y1={26}
        x2={HOOP_X + 30}
        y2={26}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={3}
        roughness={0.8}
        seed={709}
      />
      <RoughCircle
        cx={HOOP_X}
        cy={HOOP_Y}
        r={9}
        stroke={SCENE_PALETTE.rim}
        strokeWidth={2.5}
        roughness={0.9}
        seed={710}
      />
    </g>
  )
}

function ConeMarkers(): JSX.Element {
  return (
    <g aria-hidden="true">
      {[
        { x: CONE_LEFT_X, label: 'L' },
        { x: CONE_CENTER_X, label: 'M' },
        { x: CONE_RIGHT_X, label: 'R' },
      ].map((cone) => (
        <g key={cone.label}>
          {/* Cone shadow */}
          <RoughCircle
            cx={cone.x}
            cy={CONE_Y + 4}
            r={10}
            fill={SCENE_PALETTE.ink}
            fillStyle="solid"
            stroke="none"
            strokeWidth={0}
            roughness={1.0}
            seed={720 + cone.x}
          />
          {/* Top-down cone — small filled triangle pointing up */}
          <RoughPolygon
            points={[
              [cone.x, CONE_Y - 10],
              [cone.x - 8, CONE_Y + 6],
              [cone.x + 8, CONE_Y + 6],
            ]}
            fill={SCENE_PALETTE.rim}
            fillStyle="solid"
            stroke={SCENE_PALETTE.ink}
            strokeWidth={1.5}
            roughness={1.1}
            seed={730 + cone.x}
          />
          <text
            x={cone.x}
            y={CONE_Y + 26}
            textAnchor="middle"
            fill={SCENE_PALETTE.cream}
            fontFamily={HANDWRITING_FONT}
            fontSize={16}
          >
            {cone.label}
          </text>
        </g>
      ))}
    </g>
  )
}

interface ShuttleRunTraceProps {
  run: ShuttleRun
  progress: number
  isLatest: boolean
}

function ShuttleRunTrace({ run, progress, isLatest }: ShuttleRunTraceProps): JSX.Element {
  const trail = buildTrailPath(progress)
  const dot = computeShuttlePosition(progress)
  const stroke = isLatest ? SCENE_PALETTE.rim : SCENE_PALETTE.creamBright
  // Older traces fade further into the background; latest stays solid.
  const strokeOpacity = isLatest ? 0.95 : 0.32
  const strokeWidth = isLatest ? 4 : 2.5
  const finished = progress >= 1
  return (
    <g>
      {/* Glow layer for the latest trace, drawn underneath the crisp stroke. */}
      {isLatest && (
        <polyline
          points={trail}
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.32}
          filter="url(#shuttle-glow)"
        />
      )}
      <polyline
        points={trail}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!finished && (
        <circle
          cx={dot.x}
          cy={dot.y}
          r={isLatest ? 7 : 5}
          fill={stroke}
          fillOpacity={strokeOpacity}
        >
          <title>{`${run.date} — ${run.seconds.toFixed(2)}s`}</title>
        </circle>
      )}
    </g>
  )
}

interface UseShuttleElapsedArgs {
  /**
   * Slowest enabled run's runtime, in seconds. The rAF loop exits once
   * elapsed reaches this — animating beyond it would just paint nothing
   * new since every trace has already drawn its full path.
   */
  maxSeconds: number
  /** Bumped to restart the animation. */
  replayKey: number
  /** When `true`, the hook short-circuits to `maxSeconds` without ticking. */
  reducedMotion: boolean
}

/**
 * Drives a `requestAnimationFrame` loop that exposes "seconds since the
 * latest replay started" to the renderer. Stops the loop once every
 * enabled run has finished so the component isn't re-rendering 60 times
 * a second forever after the last trace lands. Replaying restarts the
 * clock by resetting on `replayKey` change.
 */
function useShuttleElapsed({ maxSeconds, replayKey, reducedMotion }: UseShuttleElapsedArgs): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (reducedMotion || maxSeconds <= 0) {
      setElapsed(maxSeconds)
      return
    }
    setElapsed(0)
    const start = performance.now()
    let raf = 0
    let cancelled = false
    const tick = (now: number) => {
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

interface ShuttleControlsProps {
  runs: readonly ShuttleRun[]
  enabled: ReadonlySet<string>
  onToggle: (date: string) => void
  onReplay: () => void
}

function ShuttleControls({
  runs,
  enabled,
  onToggle,
  onReplay,
}: ShuttleControlsProps): JSX.Element {
  return (
    <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={onReplay}
        className="rounded-full px-4 py-1.5 font-handwriting text-base transition-transform hover:-translate-y-0.5 active:translate-y-0"
        style={REPLAY_BUTTON_STYLE}
      >
        Replay
      </button>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {runs.map((run) => {
          const active = enabled.has(run.date)
          return (
            <ShuttleToggleChip
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

/**
 * Shared style for the Replay button. Pulled out so the rim-orange and
 * ink stroke colors come from {@link SCENE_PALETTE} rather than being
 * duplicated as raw hex literals in Tailwind arbitrary-value classes.
 */
const REPLAY_BUTTON_STYLE: CSSProperties = {
  backgroundColor: SCENE_PALETTE.rim,
  color: SCENE_PALETTE.ink,
  border: `2px solid ${SCENE_PALETTE.ink}`,
  boxShadow: `2px 2px 0 ${SCENE_PALETTE.ink}`,
}

interface ShuttleToggleChipProps {
  run: ShuttleRun
  active: boolean
  onToggle: () => void
}

function ShuttleToggleChip({ run, active, onToggle }: ShuttleToggleChipProps): JSX.Element {
  const label = formatShuttleChipLabel(run.date)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${label} — ${run.seconds.toFixed(2)}s shuttle`}
      onClick={onToggle}
      className="rounded-full px-3 py-1 font-handwriting"
      style={active ? CHIP_STYLE_ACTIVE : CHIP_STYLE_INACTIVE}
    >
      <span
        aria-hidden="true"
        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
        style={{ backgroundColor: active ? SCENE_PALETTE.rim : 'transparent' }}
      />
      <span>{label}</span>
      <span className="ml-1 opacity-70">· {run.seconds.toFixed(2)}s</span>
    </button>
  )
}

/**
 * Active-chip style — solid cream with an ink shadow. Module-level
 * constant so React's `style` prop diff sees a stable reference instead
 * of a fresh allocation on every animation frame.
 */
const CHIP_STYLE_ACTIVE: CSSProperties = {
  backgroundColor: SCENE_PALETTE.cream,
  color: SCENE_PALETTE.ink,
  border: `2px solid ${SCENE_PALETTE.ink}`,
  boxShadow: `2px 2px 0 ${SCENE_PALETTE.ink}`,
}

/**
 * Inactive-chip style — dashed outline at half opacity, so the chip
 * fades into the background without disappearing.
 */
const CHIP_STYLE_INACTIVE: CSSProperties = {
  backgroundColor: 'transparent',
  color: SCENE_PALETTE.ink,
  border: `2px dashed ${SCENE_PALETTE.ink}`,
  opacity: 0.5,
}
