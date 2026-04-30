import Link from 'next/link'

import type { CardioTimePoint } from '@/types/cardio'

import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import { PulsingHeart } from './PulsingHeart'
import {
  RoughCircle,
  RoughEllipse,
  RoughLineShape,
  RoughPath,
  RoughRect,
} from './rough-shapes'

/**
 * Subtle indoor-track silhouette curving across the back wall. Stays low
 * contrast so it reads as background context, not as another piece of
 * equipment competing for attention.
 */
export function IndoorTrackSilhouette() {
  return (
    <g aria-hidden="true" opacity={0.4}>
      <RoughPath
        d="M 80 540 Q 600 470 1180 510 T 1520 540"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2.5}
        roughness={1.6}
        bowing={1.5}
        seed={101}
      />
      <RoughPath
        d="M 80 562 Q 620 502 1180 532 T 1520 562"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={1.5}
        roughness={1.4}
        bowing={1.5}
        seed={102}
      />
      {/* A few lane lines to hint at a track */}
      {[120, 320, 540, 760, 980, 1200, 1420].map((x, i) => (
        <RoughLineShape
          key={`lane-${x}`}
          x1={x}
          y1={544}
          x2={x + 18}
          y2={538}
          stroke={SCENE_PALETTE.cream}
          strokeWidth={1.2}
          roughness={1.0}
          seed={103 + i}
        />
      ))}
      <text
        x={1480}
        y={500}
        textAnchor="end"
        fill={SCENE_PALETTE.cream}
        fillOpacity={0.55}
        fontFamily={HANDWRITING_FONT}
        fontSize={20}
      >
        indoor track
      </text>
    </g>
  )
}

/** Coord box for sparkline / trend projections inside a fixture. */
interface PolylineBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Project a {@link CardioTimePoint} series into an SVG `points` string fitted
 * to `box`. Y-axis is min/max-scaled across the input series with a small
 * vertical pad so the line never crashes against the box edges; x-axis spans
 * the box width with even spacing (fixture trends are short and uniformly
 * timed enough that point-index spacing reads better than time-of-day
 * spacing).
 *
 * Returns `null` when fewer than 2 points are supplied — the caller falls
 * back to the painted polyline so the wall still has a chart on it.
 */
function projectSeriesPolyline(
  series: readonly CardioTimePoint[],
  box: PolylineBox,
): { points: string; coords: Array<[number, number]> } | null {
  if (series.length < 2) return null
  const values = series.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const verticalPad = box.height * 0.1
  const drawHeight = box.height - verticalPad * 2
  const stepX = box.width / (series.length - 1)
  const coords: Array<[number, number]> = series.map((p, i) => {
    const x = box.x + i * stepX
    // Flat series (every value identical) — center the line vertically
    // rather than collapsing every point to the bottom edge of the box.
    const norm = span === 0 ? 0.5 : (p.value - min) / span
    // SVG y grows downward — invert so higher values draw higher on screen.
    const y = box.y + verticalPad + (1 - norm) * drawHeight
    return [x, y]
  })
  const points = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return { points, coords }
}

/** Props for {@link HrMonitor}. */
export interface HrMonitorProps {
  /** Live BPM value to display + drive the pulse rate. Falls back to a placeholder for a "looks alive" empty state. */
  bpm?: number
  /** Latest sparkline series (oldest → newest). Falls back to the painted polyline when fewer than 2 points exist. */
  sparkline?: readonly CardioTimePoint[]
}

const HR_SPARKLINE_BOX: PolylineBox = { x: 150, y: 200, width: 160, height: 22 }
const HR_FALLBACK_BPM = 62
// Original painted sparkline path — kept verbatim as the empty-state
// fallback so the gym wall reads as a populated room before the first
// `cardio.json` import.
const HR_FALLBACK_PATH =
  'M 150 220 L 170 212 L 190 218 L 210 205 L 230 214 L 250 200 L 270 210 L 290 200 L 310 206'

/**
 * Wall-mounted heart-rate readout (PRD §7.4): small framed display showing
 * the latest resting BPM with a sparkline trend below. The heart glyph
 * pulses at the displayed BPM via {@link PulsingHeart}.
 *
 * Both `bpm` and `sparkline` are optional — caller can pass nothing and the
 * fixture still renders a "painted" version with the original placeholder
 * value, matching the empty state of `getCardioData()` returning `null`.
 */
export function HrMonitor({ bpm, sparkline }: HrMonitorProps = {}) {
  const displayBpm = bpm ?? HR_FALLBACK_BPM
  const projected = sparkline
    ? projectSeriesPolyline(sparkline, HR_SPARKLINE_BOX)
    : null

  return (
    <g>
      <RoughRect
        x={120}
        y={90}
        width={220}
        height={150}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={3}
        roughness={1.0}
        seed={120}
      />
      {/* Inner glow line */}
      <RoughRect
        x={130}
        y={100}
        width={200}
        height={130}
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={1}
        roughness={0.8}
        seed={121}
      />

      {/* Header: `♥ resting hr` rendered as a single centered text block.
          The heart is a `<motion.tspan>` inside the same `<text>` so the
          pulse animates the glyph in place without breaking the original
          layout. */}
      <text
        x={230}
        y={140}
        textAnchor="middle"
        fill={SCENE_PALETTE.rimSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        <PulsingHeart bpm={displayBpm} /> resting hr
      </text>
      <text
        x={230}
        y={195}
        textAnchor="middle"
        fill={SCENE_PALETTE.creamBright}
        fontFamily={HANDWRITING_FONT}
        fontSize={48}
        fontWeight={700}
      >
        {displayBpm}
      </text>
      {projected ? (
        <polyline
          points={projected.points}
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <RoughPath
          d={HR_FALLBACK_PATH}
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={2}
          roughness={1.2}
          seed={122}
        />
      )}
      <text
        x={230}
        y={272}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={18}
      >
        wall monitor
      </text>
    </g>
  )
}

/** Props for {@link Vo2MaxWhiteboard}. */
export interface Vo2MaxWhiteboardProps {
  /** Latest VO2max value (ml/kg/min). Falls back to the painted placeholder. */
  value?: number
  /** Latest trend series (oldest → newest). Falls back to the painted polyline + dots when fewer than 2 points exist. */
  trend?: readonly CardioTimePoint[]
}

const VO2_TREND_BOX: PolylineBox = { x: 420, y: 200, width: 300, height: 60 }
const VO2_FALLBACK_VALUE = 47.8
// Original painted trend coordinates — fallback when `trend` is missing.
const VO2_FALLBACK_COORDS: Array<[number, number]> = [
  [420, 250], [470, 238], [520, 242], [570, 224], [620, 218], [670, 206], [720, 200],
]

/**
 * Hand-drawn whiteboard tracking the rolling VO2max trend (PRD §7.4).
 * The chart is a roughjs polyline drawn as if sketched in marker.
 *
 * Both `value` and `trend` are optional — empty / missing data falls back
 * to the painted trend so the whiteboard isn't blank for first-time
 * visitors before they import any cardio data.
 */
export function Vo2MaxWhiteboard({
  value,
  trend,
}: Vo2MaxWhiteboardProps = {}) {
  const displayValue = value ?? VO2_FALLBACK_VALUE
  const projected = trend ? projectSeriesPolyline(trend, VO2_TREND_BOX) : null
  const coords = projected?.coords ?? VO2_FALLBACK_COORDS

  return (
    <g>
      {/* Frame */}
      <RoughRect
        x={400}
        y={80}
        width={360}
        height={210}
        fill={SCENE_PALETTE.whiteboard}
        fillStyle="solid"
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={3}
        roughness={1.1}
        seed={140}
      />
      {/* Inner ghost frame */}
      <RoughRect
        x={410}
        y={90}
        width={340}
        height={190}
        fill="none"
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={1}
        roughness={0.9}
        seed={141}
      />
      {/* Marker tray */}
      <RoughRect
        x={400}
        y={290}
        width={360}
        height={8}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.8}
        seed={142}
      />

      <text
        x={420}
        y={120}
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={26}
        fontWeight={700}
      >
        VO₂max
      </text>
      <text
        x={740}
        y={120}
        textAnchor="end"
        fill={SCENE_PALETTE.rim}
        fontFamily={HANDWRITING_FONT}
        fontSize={32}
        fontWeight={700}
      >
        {displayValue.toFixed(1)}
      </text>

      {/* Hand-drawn trend chart */}
      {projected ? (
        <polyline
          points={projected.points}
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <RoughPath
          d="M 420 250 L 470 238 L 520 242 L 570 224 L 620 218 L 670 206 L 720 200"
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={3}
          roughness={1.5}
          bowing={1}
          seed={143}
        />
      )}
      {/* Data point dots */}
      {coords.map(([x, y], i) => (
        <RoughCircle
          key={`vo2-dot-${i}`}
          cx={x}
          cy={y}
          r={3}
          fill={SCENE_PALETTE.rim}
          fillStyle="solid"
          stroke={SCENE_PALETTE.ink}
          strokeWidth={0.8}
          roughness={0.7}
          seed={144 + i}
        />
      ))}
      {/* X-axis */}
      <RoughLineShape
        x1={420}
        y1={262}
        x2={740}
        y2={262}
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={1.5}
        roughness={0.8}
        seed={155}
      />
      {/* Trend ticks — anchored to the projected x positions so the ticks
          stay aligned with the data points rather than a hardcoded grid. */}
      {coords.map(([x], i) => (
        <RoughLineShape
          key={`vo2-tick-${i}`}
          x1={x}
          y1={262}
          x2={x}
          y2={266}
          stroke={SCENE_PALETTE.inkSoft}
          strokeWidth={1.2}
          roughness={0.5}
          seed={156 + i}
        />
      ))}
      <text
        x={580}
        y={320}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={18}
      >
        coach&apos;s whiteboard
      </text>
    </g>
  )
}

/** Props for {@link WallScoreboard}. */
export interface WallScoreboardProps {
  /** Sessions logged in the rolling-7-day window. Falls back to a placeholder when omitted. */
  sessions?: number
  /** Total duration in the window, formatted `H:MM`. Falls back to a placeholder when omitted. */
  durationLabel?: string
  /** Total distance in the window, formatted to one decimal mile (e.g. `11.6`). Falls back to a placeholder when omitted. */
  milesLabel?: string
}

const WALL_FALLBACK = {
  sessions: 5,
  durationLabel: '4:12',
  milesLabel: '11.6',
} as const

/**
 * Wall scoreboard (PRD §7.4) showing this rolling-7-day window's totals
 * (sessions, time, distance) — black panel with banner-yellow trim and
 * cream digits. Same display contract as the Combine `<Scoreboard>`
 * (a region of three labeled cells), painted to live in-scene rather
 * than reusing the HTML component verbatim.
 *
 * All three values default to placeholders so the static scene reads as a
 * populated room when `cardio.json` doesn't exist yet.
 */
export function WallScoreboard({
  sessions,
  durationLabel,
  milesLabel,
}: WallScoreboardProps = {}) {
  const stats: Array<{ label: string; value: string }> = [
    { label: 'sessions', value: String(sessions ?? WALL_FALLBACK.sessions) },
    { label: 'time', value: durationLabel ?? WALL_FALLBACK.durationLabel },
    { label: 'miles', value: milesLabel ?? WALL_FALLBACK.milesLabel },
  ]

  return (
    <g>
      {/* Panel */}
      <RoughRect
        x={820}
        y={80}
        width={400}
        height={210}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.banner}
        strokeWidth={3}
        roughness={1.0}
        seed={170}
      />
      {/* Inner trim */}
      <RoughRect
        x={830}
        y={90}
        width={380}
        height={190}
        fill="none"
        stroke={SCENE_PALETTE.banner}
        strokeWidth={1}
        roughness={0.8}
        seed={171}
      />
      {/* Mounting tabs */}
      <RoughRect x={836} y={68} width={30} height={16} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.2} roughness={0.7} seed={172} />
      <RoughRect x={1174} y={68} width={30} height={16} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.2} roughness={0.7} seed={173} />

      <text
        x={1020}
        y={120}
        textAnchor="middle"
        fill={SCENE_PALETTE.banner}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        this week
      </text>
      {stats.map((stat, i) => {
        const cx = 880 + i * 140
        return (
          <g key={stat.label}>
            <text
              x={cx}
              y={210}
              textAnchor="middle"
              fill={SCENE_PALETTE.creamBright}
              fontFamily={HANDWRITING_FONT}
              fontSize={48}
              fontWeight={700}
            >
              {stat.value}
            </text>
            <text
              x={cx}
              y={252}
              textAnchor="middle"
              fill={SCENE_PALETTE.rimSoft}
              fontFamily={HANDWRITING_FONT}
              fontSize={18}
            >
              {stat.label}
            </text>
          </g>
        )
      })}
      <text
        x={1020}
        y={320}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={18}
      >
        wall scoreboard
      </text>
    </g>
  )
}

/**
 * Wooden bench with a tablet/clipboard resting on top. Stands in for the
 * "tap to re-import" affordance from the PRD without yet wiring it up.
 */
export function BenchWithTablet() {
  return (
    <g>
      {/* Cast shadow */}
      <RoughEllipse
        cx={1050}
        cy={832}
        width={240}
        height={14}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={0.4}
        roughness={1.5}
        seed={190}
      />
      {/* Bench top */}
      <RoughRect
        x={940}
        y={760}
        width={220}
        height={20}
        fill={SCENE_PALETTE.hardwoodLight}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.8}
        roughness={1.0}
        seed={191}
      />
      {/* Wood grain hint */}
      <RoughLineShape x1={950} y1={770} x2={1150} y2={770} stroke={SCENE_PALETTE.hardwoodDark} strokeWidth={0.8} roughness={1.6} seed={192} />
      {/* Bench legs */}
      <RoughRect x={960} y={780} width={14} height={50} fill={SCENE_PALETTE.hardwoodDark} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={0.9} seed={193} />
      <RoughRect x={1126} y={780} width={14} height={50} fill={SCENE_PALETTE.hardwoodDark} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={0.9} seed={194} />

      {/* Clipboard, tilted */}
      <g transform="translate(960, 640) rotate(-6)">
        <RoughRect
          x={0}
          y={0}
          width={170}
          height={130}
          fill={SCENE_PALETTE.creamBright}
          fillStyle="solid"
          stroke={SCENE_PALETTE.inkSoft}
          strokeWidth={2.5}
          roughness={1.0}
          seed={195}
        />
        {/* Clip at top */}
        <RoughRect x={55} y={-10} width={60} height={20} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={0.7} seed={196} />
        <text
          x={20}
          y={36}
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={18}
          fontWeight={700}
        >
          last import
        </text>
        <text
          x={20}
          y={68}
          fill={SCENE_PALETTE.rim}
          fontFamily={HANDWRITING_FONT}
          fontSize={26}
          fontWeight={700}
        >
          apr 24
        </text>
        <RoughLineShape x1={20} y1={88} x2={150} y2={88} stroke={SCENE_PALETTE.inkSoft} strokeWidth={1.2} roughness={0.6} seed={197} />
        <RoughLineShape x1={20} y1={104} x2={130} y2={104} stroke={SCENE_PALETTE.inkSoft} strokeWidth={1.2} roughness={0.6} seed={198} />
      </g>

      <text
        x={1050}
        y={862}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={20}
      >
        bench + clipboard
      </text>
    </g>
  )
}

/**
 * Back-wall door that opens into The Combine. The full door group is wrapped
 * in a Next.js `<Link>` so the spatial connection between the two sub-areas
 * is real navigation. A `:focus-visible` rim-orange dashed ring gives
 * keyboard users a high-contrast cue beyond the door fill darken on focus.
 */
export function DoorToCombine() {
  return (
    <Link
      href="/training-facility/combine"
      aria-label="Walk through the back door into The Combine"
      className="group focus:outline-none"
    >
      {/* Door frame */}
      <RoughRect
        x={1300}
        y={150}
        width={200}
        height={440}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={3}
        roughness={1.1}
        seed={210}
      />
      {/* Inset door panel */}
      <RoughRect
        x={1316}
        y={170}
        width={168}
        height={400}
        fill={SCENE_PALETTE.hardwoodMid}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={211}
      />
      {/* Hover/focus tint as a translucent overlay using the existing classes */}
      <rect
        x={1316}
        y={170}
        width={168}
        height={400}
        fill="#6b3e1a"
        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      {/* Recessed inner panels */}
      <RoughRect
        x={1336}
        y={194}
        width={128}
        height={150}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={212}
      />
      <RoughRect
        x={1336}
        y={364}
        width={128}
        height={180}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={213}
      />
      {/* Door handle */}
      <RoughCircle cx={1348} cy={380} r={5} fill={SCENE_PALETTE.banner} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1} roughness={0.7} seed={214} />
      {/* Spotlight underfoot */}
      <RoughEllipse cx={1400} cy={595} width={240} height={20} fill={SCENE_PALETTE.rim} fillStyle="solid" stroke={SCENE_PALETTE.rim} strokeWidth={0.4} roughness={1.5} seed={215} />

      {/* Focus ring — visible only when the Link is keyboard-focused */}
      <rect
        x={1294}
        y={144}
        width={212}
        height={452}
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={4}
        strokeDasharray="6 4"
        rx={3}
        className="opacity-0 transition-opacity group-focus-visible:opacity-100"
      />

      {/* Sign overhead */}
      <RoughRect
        x={1296}
        y={94}
        width={208}
        height={48}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={216}
      />
      <text
        x={1400}
        y={128}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={26}
        fontWeight={700}
      >
        → the combine
      </text>
      <text
        x={1400}
        y={636}
        textAnchor="middle"
        fill={SCENE_PALETTE.rimSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={20}
      >
        back door
      </text>
    </Link>
  )
}
