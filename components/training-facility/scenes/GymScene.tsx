import Link from 'next/link'

import {
  HANDWRITING_FONT,
  HandFrame,
  HandLabel,
  HardwoodFloor,
  SceneDefs,
  SCENE_PALETTE,
  WallBand,
} from './scene-primitives'

const VIEWBOX_WIDTH = 1600
const VIEWBOX_HEIGHT = 900
const FLOOR_TOP = 600

/**
 * Side-on illustration of The Gym — the cardio sub-area of the Training
 * Facility. Mirrors PRD §7.4: stair climber centered, treadmill, indoor track
 * silhouette behind, HR monitor + VO2max whiteboard + scoreboard along the
 * wall, tablet on a bench, and a back door that leads to The Combine.
 *
 * Phase 1 build — equipment is decorative only. The door at the back is the
 * single interactive element so the two sub-area scenes connect spatially.
 * Detail views and equipment interactivity ship in later issues.
 */
export function GymScene() {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      role="img"
      aria-label="The Gym — side-on view of stair climber, treadmill, indoor track, wall fixtures, and a door leading to the Combine."
    >
      <SceneDefs />

      <WallBand width={VIEWBOX_WIDTH} height={FLOOR_TOP} />
      <rect
        x={0}
        y={0}
        width={VIEWBOX_WIDTH}
        height={FLOOR_TOP}
        fill="url(#sceneSpotlight)"
      />

      <IndoorTrackSilhouette />

      <HardwoodFloor
        y={FLOOR_TOP}
        height={VIEWBOX_HEIGHT - FLOOR_TOP}
        width={VIEWBOX_WIDTH}
      />

      <HrMonitor />
      <Vo2MaxWhiteboard />
      <WallScoreboard />

      <Treadmill />
      <StairClimber />
      <BenchWithTablet />

      <DoorToCombine />
    </svg>
  )
}

/**
 * Subtle ribbon of an indoor track curving across the back wall. Stays low
 * contrast so it reads as background context, not as another piece of
 * equipment competing for attention.
 */
function IndoorTrackSilhouette() {
  return (
    <g aria-hidden="true" opacity={0.35}>
      <path
        d="M 80 540 Q 600 470 1180 510 T 1520 540"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.4}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      <path
        d="M 80 560 Q 620 500 1180 530 T 1520 560"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.18}
        strokeWidth={1.4}
      />
      <text
        x={1480}
        y={500}
        textAnchor="end"
        fill={SCENE_PALETTE.cream}
        fillOpacity={0.45}
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
 * value with a tiny sparkline below.
 */
function HrMonitor() {
  return (
    <g>
      <HandFrame x={120} y={90} width={220} height={150} fill={SCENE_PALETTE.ink} stroke={SCENE_PALETTE.rim}>
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
        <polyline
          points="150,220 170,212 190,218 210,205 230,214 250,200 270,210 290,200 310,206"
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </HandFrame>
      <HandLabel x={230} y={272} size={18} color={SCENE_PALETTE.cream}>
        wall monitor
      </HandLabel>
    </g>
  )
}

/**
 * Hand-drawn whiteboard tracking the rolling VO2max trend. The chart is a
 * simple polyline drawn as if sketched in marker.
 */
function Vo2MaxWhiteboard() {
  return (
    <g>
      <HandFrame x={400} y={80} width={360} height={210}>
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
        <polyline
          points="420,250 470,238 520,242 570,224 620,218 670,206 720,200"
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={420}
          y1={262}
          x2={740}
          y2={262}
          stroke={SCENE_PALETTE.inkSoft}
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        {/* Trend ticks */}
        {[420, 470, 520, 570, 620, 670, 720].map(x => (
          <line
            key={`vo2-tick-${x}`}
            x1={x}
            y1={262}
            x2={x}
            y2={266}
            stroke={SCENE_PALETTE.inkSoft}
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        ))}
      </HandFrame>
      <HandLabel x={580} y={320} size={18}>
        coach&apos;s whiteboard
      </HandLabel>
    </g>
  )
}

/**
 * Wall scoreboard showing this week's totals (sessions, time, distance).
 * Reuses the courtfolio scoreboard look — black panel with cream digits.
 */
function WallScoreboard() {
  const stats: Array<{ label: string; value: string }> = [
    { label: 'sessions', value: '5' },
    { label: 'time', value: '4:12' },
    { label: 'miles', value: '11.6' },
  ]

  return (
    <g>
      <HandFrame
        x={820}
        y={80}
        width={400}
        height={210}
        fill={SCENE_PALETTE.ink}
        stroke={SCENE_PALETTE.banner}
      >
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
      </HandFrame>
      <HandLabel x={1020} y={320} size={18}>
        wall scoreboard
      </HandLabel>
    </g>
  )
}

/**
 * Treadmill rendered side-on: long deck with a console rising at the right
 * end. Display screen shows a small pace icon.
 */
function Treadmill() {
  return (
    <g>
      {/* Deck */}
      <rect
        x={140}
        y={770}
        width={300}
        height={36}
        rx={6}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      <rect
        x={148}
        y={774}
        width={284}
        height={28}
        rx={4}
        fill={SCENE_PALETTE.hardwoodLight}
        opacity={0.55}
      />
      {/* Belt seams */}
      {Array.from({ length: 12 }).map((_, i) => (
        <line
          key={`belt-${i}`}
          x1={150 + i * 24}
          y1={774}
          x2={150 + i * 24}
          y2={802}
          stroke={SCENE_PALETTE.ink}
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      ))}
      {/* Side rail */}
      <rect
        x={140}
        y={760}
        width={300}
        height={6}
        rx={2}
        fill={SCENE_PALETTE.cream}
        opacity={0.7}
      />
      {/* Console upright */}
      <rect
        x={400}
        y={500}
        width={14}
        height={270}
        fill={SCENE_PALETTE.inkSoft}
      />
      {/* Console screen */}
      <HandFrame
        x={350}
        y={470}
        width={120}
        height={90}
        fill={SCENE_PALETTE.ink}
        stroke={SCENE_PALETTE.rim}
        rx={4}
      >
        <text
          x={410}
          y={510}
          textAnchor="middle"
          fill={SCENE_PALETTE.rimSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={20}
        >
          pace
        </text>
        <text
          x={410}
          y={542}
          textAnchor="middle"
          fill={SCENE_PALETTE.creamBright}
          fontFamily={HANDWRITING_FONT}
          fontSize={30}
          fontWeight={700}
        >
          9:42
        </text>
      </HandFrame>
      {/* Front handle */}
      <path
        d="M 360 500 L 360 480 L 460 480 L 460 500"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.7}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <HandLabel x={290} y={848}>
        treadmill
      </HandLabel>
    </g>
  )
}

/**
 * Stair climber — the centerpiece of the Gym. Tall body with a step ladder
 * at the front and a small console up top. Cream handrails frame the unit.
 */
function StairClimber() {
  return (
    <g>
      {/* Base footprint shadow */}
      <ellipse
        cx={730}
        cy={830}
        rx={170}
        ry={14}
        fill={SCENE_PALETTE.ink}
        opacity={0.55}
      />
      {/* Body column */}
      <rect
        x={650}
        y={420}
        width={160}
        height={400}
        rx={10}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.4}
        strokeWidth={1.5}
      />
      {/* Body highlight */}
      <rect
        x={660}
        y={430}
        width={20}
        height={380}
        rx={6}
        fill={SCENE_PALETTE.cream}
        opacity={0.08}
      />
      {/* Steps stacked at the front */}
      {Array.from({ length: 6 }).map((_, i) => {
        const yTop = 540 + i * 38
        const xLeft = 580 - i * 6
        return (
          <g key={`step-${i}`}>
            <rect
              x={xLeft}
              y={yTop}
              width={90}
              height={20}
              fill={SCENE_PALETTE.hardwoodLight}
              stroke={SCENE_PALETTE.ink}
              strokeWidth={1.5}
            />
            <rect
              x={xLeft}
              y={yTop + 20}
              width={90}
              height={18}
              fill={SCENE_PALETTE.hardwoodMid}
              stroke={SCENE_PALETTE.ink}
              strokeWidth={1.5}
            />
          </g>
        )
      })}
      {/* Handrails */}
      <path
        d="M 555 560 Q 540 470 580 430 L 660 430"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.85}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 870 560 Q 880 470 850 430 L 810 430"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.85}
        strokeWidth={6}
        strokeLinecap="round"
      />
      {/* Console screen */}
      <HandFrame
        x={660}
        y={440}
        width={140}
        height={90}
        fill={SCENE_PALETTE.ink}
        stroke={SCENE_PALETTE.rim}
        rx={4}
      >
        <text
          x={730}
          y={478}
          textAnchor="middle"
          fill={SCENE_PALETTE.rimSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={18}
        >
          steps / min
        </text>
        <text
          x={730}
          y={514}
          textAnchor="middle"
          fill={SCENE_PALETTE.creamBright}
          fontFamily={HANDWRITING_FONT}
          fontSize={30}
          fontWeight={700}
        >
          84
        </text>
      </HandFrame>
      <HandLabel x={730} y={870} size={24}>
        stair climber
      </HandLabel>
    </g>
  )
}

/**
 * Wooden bench against the back wall with a clipboard / tablet resting on
 * top. Stands in for the "tap to re-import" affordance from the PRD without
 * yet wiring the import flow.
 */
function BenchWithTablet() {
  return (
    <g>
      {/* Bench top */}
      <rect
        x={940}
        y={760}
        width={220}
        height={20}
        rx={4}
        fill={SCENE_PALETTE.hardwoodLight}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
      />
      {/* Bench legs */}
      <rect x={960} y={780} width={14} height={50} fill={SCENE_PALETTE.hardwoodDark} />
      <rect x={1126} y={780} width={14} height={50} fill={SCENE_PALETTE.hardwoodDark} />
      {/* Clipboard */}
      <g transform="translate(960, 640) rotate(-6)">
        <HandFrame x={0} y={0} width={170} height={130} fill={SCENE_PALETTE.creamBright}>
          <rect x={55} y={-10} width={60} height={20} rx={3} fill={SCENE_PALETTE.inkSoft} />
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
          <line x1={20} y1={88} x2={150} y2={88} stroke={SCENE_PALETTE.inkSoft} strokeOpacity={0.4} strokeWidth={1.5} />
          <line x1={20} y1={104} x2={130} y2={104} stroke={SCENE_PALETTE.inkSoft} strokeOpacity={0.3} strokeWidth={1.5} />
        </HandFrame>
      </g>
      <HandLabel x={1050} y={848}>
        bench + clipboard
      </HandLabel>
    </g>
  )
}

/**
 * The back door that opens into The Combine. The full door is a Next.js
 * `<Link>` so the spatial connection between sub-areas is real navigation,
 * not just chrome.
 */
function DoorToCombine() {
  return (
    <Link
      href="/training-facility/combine"
      aria-label="Walk through the back door into The Combine"
      className="group focus:outline-none"
    >
      {/* Door frame */}
      <rect
        x={1300}
        y={150}
        width={200}
        height={440}
        fill={SCENE_PALETTE.hardwoodDark}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={3}
      />
      {/* Inset door panel */}
      <rect
        x={1316}
        y={170}
        width={168}
        height={400}
        fill={SCENE_PALETTE.hardwoodMid}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        className="transition-colors group-hover:fill-[#6b3e1a] group-focus-visible:fill-[#6b3e1a]"
      />
      {/* Focus ring — visible only when the Link is keyboard-focused, so
          keyboard users get a high-contrast cue beyond the door fill darken. */}
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
      {/* Recessed inner panels */}
      <rect
        x={1336}
        y={194}
        width={128}
        height={150}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeOpacity={0.55}
        strokeWidth={2}
      />
      <rect
        x={1336}
        y={364}
        width={128}
        height={180}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeOpacity={0.55}
        strokeWidth={2}
      />
      {/* Door handle */}
      <circle cx={1348} cy={380} r={5} fill={SCENE_PALETTE.banner} />
      {/* Spotlight underfoot */}
      <ellipse cx={1400} cy={595} rx={120} ry={10} fill={SCENE_PALETTE.rim} opacity={0.18} />
      {/* Sign overhead */}
      <HandFrame
        x={1296}
        y={94}
        width={208}
        height={48}
        fill={SCENE_PALETTE.banner}
        stroke={SCENE_PALETTE.ink}
        rx={4}
      >
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
      </HandFrame>
      <HandLabel x={1400} y={636} color={SCENE_PALETTE.rimSoft}>
        back door
      </HandLabel>
    </Link>
  )
}
