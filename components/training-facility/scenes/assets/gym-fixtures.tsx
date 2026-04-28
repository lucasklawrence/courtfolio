import Link from 'next/link'

import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
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

/**
 * Wall-mounted heart-rate readout: small framed display showing a resting BPM
 * value with a tiny sparkline below. Hand-drawn frame and pulsing-marker
 * sparkline.
 */
export function HrMonitor() {
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

      <text
        x={230}
        y={140}
        textAnchor="middle"
        fill={SCENE_PALETTE.rimSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        ♥ resting hr
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
        62
      </text>
      <RoughPath
        d="M 150 220 L 170 212 L 190 218 L 210 205 L 230 214 L 250 200 L 270 210 L 290 200 L 310 206"
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={2}
        roughness={1.2}
        seed={122}
      />
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

/**
 * Hand-drawn whiteboard tracking the rolling VO2max trend. The chart is a
 * roughjs polyline drawn as if sketched in marker.
 */
export function Vo2MaxWhiteboard() {
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
        47.8
      </text>

      {/* Hand-drawn trend chart */}
      <RoughPath
        d="M 420 250 L 470 238 L 520 242 L 570 224 L 620 218 L 670 206 L 720 200"
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={3}
        roughness={1.5}
        bowing={1}
        seed={143}
      />
      {/* Data point dots */}
      {[
        [420, 250], [470, 238], [520, 242], [570, 224], [620, 218], [670, 206], [720, 200],
      ].map(([x, y], i) => (
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
      {/* Trend ticks */}
      {[420, 470, 520, 570, 620, 670, 720].map((x, i) => (
        <RoughLineShape
          key={`vo2-tick-${x}`}
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

/**
 * Wall scoreboard showing this week's totals (sessions, time, distance) —
 * black panel with banner-yellow trim and cream digits.
 */
export function WallScoreboard() {
  const stats: Array<{ label: string; value: string }> = [
    { label: 'sessions', value: '5' },
    { label: 'time', value: '4:12' },
    { label: 'miles', value: '11.6' },
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
