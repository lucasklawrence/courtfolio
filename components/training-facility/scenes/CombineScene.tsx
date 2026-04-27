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
 * Side-on illustration of The Combine — the movement-benchmark sub-area of the
 * Training Facility. Mirrors PRD §7.5: a staging area, less equipment-dense
 * than the Gym, with cones lined up for the 5-10-5 shuttle, a prominent
 * stopwatch, and a Vertec-style vertical-jump station against the right wall.
 *
 * Phase 1 build — equipment is decorative only. The seven signature
 * visualizations from §9 will populate the route in later issues.
 */
export function CombineScene() {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      role="img"
      aria-label="The Combine — staging area with shuttle cones, a stopwatch, a Vertec vertical-jump station, and a results board on the wall."
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

      <HardwoodFloor
        y={FLOOR_TOP}
        height={VIEWBOX_HEIGHT - FLOOR_TOP}
        width={VIEWBOX_WIDTH}
      />

      <CourtMarkings />

      <ResultsBoard />
      <CombineHeaderSign />

      <ShuttleCones />
      <Stopwatch />
      <VertecStation />
      <TapeMeasure />
    </svg>
  )
}

/**
 * Court-line cream markings on the floor to suggest the staging area sits on
 * a half-court. A baseline along the back of the floor and a partial
 * free-throw arc curving up at the right give the room a sense of place.
 */
function CourtMarkings() {
  return (
    <g aria-hidden="true">
      {/* Baseline strip along the back of the floor */}
      <line
        x1={40}
        y1={620}
        x2={1560}
        y2={620}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.6}
        strokeWidth={3}
      />
      {/* Free-throw arc fragment, curving forward */}
      <path
        d="M 1100 620 Q 1260 720 1100 820"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.45}
        strokeWidth={3}
      />
      {/* Cross-court tick marks */}
      {[200, 460, 720, 980].map(x => (
        <line
          key={`court-tick-${x}`}
          x1={x}
          y1={616}
          x2={x}
          y2={628}
          stroke={SCENE_PALETTE.cream}
          strokeOpacity={0.5}
          strokeWidth={2}
        />
      ))}
    </g>
  )
}

/**
 * Banner-style sign hanging on the back wall that reads "the combine" — the
 * Combine equivalent of the wall scoreboard, but more banner-yellow than
 * scoreboard-black.
 */
function CombineHeaderSign() {
  return (
    <g>
      <HandFrame
        x={520}
        y={90}
        width={560}
        height={120}
        fill={SCENE_PALETTE.banner}
        stroke={SCENE_PALETTE.ink}
        rx={6}
      >
        <text
          x={800}
          y={150}
          textAnchor="middle"
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={26}
        >
          welcome to
        </text>
        <text
          x={800}
          y={190}
          textAnchor="middle"
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={50}
          fontWeight={700}
        >
          THE COMBINE
        </text>
      </HandFrame>
      {/* Hanging strings */}
      <line x1={560} y1={40} x2={560} y2={90} stroke={SCENE_PALETTE.cream} strokeOpacity={0.5} strokeWidth={1.5} />
      <line x1={1040} y1={40} x2={1040} y2={90} stroke={SCENE_PALETTE.cream} strokeOpacity={0.5} strokeWidth={1.5} />
    </g>
  )
}

/**
 * Wall-mounted results board — a clipboard pinned next to the header sign,
 * showing the latest benchmark numbers as hand-printed stat lines.
 */
function ResultsBoard() {
  const lines: Array<{ label: string; value: string; unit: string }> = [
    { label: '5-10-5 shuttle', value: '5.42', unit: 's' },
    { label: 'vertical', value: '22.0', unit: 'in' },
    { label: '10y sprint', value: '1.91', unit: 's' },
  ]

  return (
    <g>
      <HandFrame x={120} y={110} width={340} height={250} fill={SCENE_PALETTE.creamBright}>
        {/* Pinned binder clip */}
        <rect x={270} y={100} width={40} height={18} rx={3} fill={SCENE_PALETTE.inkSoft} />
        <text
          x={290}
          y={155}
          textAnchor="middle"
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={22}
          fontWeight={700}
        >
          latest measurables
        </text>
        <line
          x1={140}
          y1={170}
          x2={440}
          y2={170}
          stroke={SCENE_PALETTE.inkSoft}
          strokeOpacity={0.4}
          strokeWidth={1.5}
        />
        {lines.map((line, i) => {
          const y = 200 + i * 44
          return (
            <g key={line.label}>
              <text
                x={140}
                y={y}
                fill={SCENE_PALETTE.inkSoft}
                fontFamily={HANDWRITING_FONT}
                fontSize={20}
              >
                {line.label}
              </text>
              <text
                x={440}
                y={y}
                textAnchor="end"
                fill={SCENE_PALETTE.rim}
                fontFamily={HANDWRITING_FONT}
                fontSize={26}
                fontWeight={700}
              >
                {line.value}
                <tspan
                  fontSize={16}
                  fill={SCENE_PALETTE.inkSoft}
                  fillOpacity={0.7}
                >
                  {' '}
                  {line.unit}
                </tspan>
              </text>
              <line
                x1={140}
                y1={y + 8}
                x2={440}
                y2={y + 8}
                stroke={SCENE_PALETTE.inkSoft}
                strokeOpacity={0.25}
                strokeWidth={1}
              />
            </g>
          )
        })}
      </HandFrame>
      <HandLabel x={290} y={388} size={18}>
        results board
      </HandLabel>
    </g>
  )
}

/**
 * Three pylon cones lined up for a 5-10-5 shuttle drill, sized so the
 * foreground cone reads larger than the rear one and the run-line is
 * suggested by a dashed mark on the floor.
 */
function ShuttleCones() {
  const cones: Array<{ cx: number; baseY: number; height: number }> = [
    { cx: 280, baseY: 820, height: 90 },
    { cx: 540, baseY: 820, height: 110 },
    { cx: 800, baseY: 820, height: 90 },
  ]

  return (
    <g>
      {/* Run line */}
      <line
        x1={200}
        y1={845}
        x2={880}
        y2={845}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.35}
        strokeDasharray="10 8"
        strokeWidth={2}
      />
      {cones.map((cone, i) => (
        <g key={`cone-${i}`}>
          {/* Cone body */}
          <path
            d={`M ${cone.cx} ${cone.baseY - cone.height} L ${cone.cx - cone.height * 0.4} ${cone.baseY} L ${cone.cx + cone.height * 0.4} ${cone.baseY} Z`}
            fill={SCENE_PALETTE.rim}
            stroke={SCENE_PALETTE.ink}
            strokeWidth={2}
          />
          {/* Reflective stripe */}
          <path
            d={`M ${cone.cx - cone.height * 0.2} ${cone.baseY - cone.height * 0.45} L ${cone.cx + cone.height * 0.2} ${cone.baseY - cone.height * 0.45} L ${cone.cx + cone.height * 0.26} ${cone.baseY - cone.height * 0.3} L ${cone.cx - cone.height * 0.26} ${cone.baseY - cone.height * 0.3} Z`}
            fill={SCENE_PALETTE.creamBright}
            opacity={0.92}
          />
          {/* Base */}
          <rect
            x={cone.cx - cone.height * 0.55}
            y={cone.baseY - 4}
            width={cone.height * 1.1}
            height={10}
            rx={2}
            fill={SCENE_PALETTE.hardwoodDark}
            stroke={SCENE_PALETTE.ink}
            strokeWidth={1.5}
          />
          {/* Shadow */}
          <ellipse
            cx={cone.cx}
            cy={cone.baseY + 12}
            rx={cone.height * 0.45}
            ry={4}
            fill={SCENE_PALETTE.ink}
            opacity={0.5}
          />
        </g>
      ))}
      <HandLabel x={540} y={870}>
        shuttle cones
      </HandLabel>
    </g>
  )
}

/**
 * Big hand-drawn stopwatch sitting in the center-front of the staging area.
 * Works as an icon and as a focal point — it's the one piece of equipment
 * that visually says "this is where times are taken."
 */
function Stopwatch() {
  const cx = 1010
  const cy = 720
  const r = 80
  return (
    <g>
      {/* Crown */}
      <rect
        x={cx - 12}
        y={cy - r - 28}
        width={24}
        height={20}
        rx={3}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.6}
      />
      <rect
        x={cx - 22}
        y={cy - r - 12}
        width={44}
        height={10}
        rx={2}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.6}
      />
      {/* Side button */}
      <rect
        x={cx + r - 18}
        y={cy - r - 6}
        width={14}
        height={12}
        rx={2}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.6}
        transform={`rotate(35, ${cx + r - 11}, ${cy - r})`}
      />
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r + 6} fill={SCENE_PALETTE.inkSoft} />
      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill={SCENE_PALETTE.creamBright} stroke={SCENE_PALETTE.ink} strokeWidth={3} />
      {/* Hour ticks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        const x1 = cx + Math.cos(angle) * (r - 10)
        const y1 = cy + Math.sin(angle) * (r - 10)
        const x2 = cx + Math.cos(angle) * (r - 2)
        const y2 = cy + Math.sin(angle) * (r - 2)
        return (
          <line
            key={`tick-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={SCENE_PALETTE.inkSoft}
            strokeWidth={i % 3 === 0 ? 3 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
      {/* Hands — held at 5.42s position for a rough shuttle visual */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.cos((5.42 / 60) * Math.PI * 2 - Math.PI / 2) * (r - 18)}
        y2={cy + Math.sin((5.42 / 60) * Math.PI * 2 - Math.PI / 2) * (r - 18)}
        stroke={SCENE_PALETTE.rim}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={5} fill={SCENE_PALETTE.rim} />
      {/* Digital readout */}
      <text
        x={cx}
        y={cy + 36}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
        fontWeight={700}
      >
        5.42
      </text>
      <HandLabel x={cx} y={cy + r + 60}>
        stopwatch
      </HandLabel>
    </g>
  )
}

/**
 * Vertec-style vertical-jump station at the right side of the staging area.
 * A vertical pole rises out of a heavy base, and a stack of horizontal vanes
 * fans out at the top — the cluster the athlete swats at the apex of a jump.
 */
function VertecStation() {
  const baseX = 1320
  const baseY = 820
  const poleHeight = 480
  const poleX = baseX + 40
  const vanes = Array.from({ length: 16 }, (_, i) => i)
  return (
    <g>
      {/* Base */}
      <rect
        x={baseX}
        y={baseY - 20}
        width={120}
        height={20}
        rx={3}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.4}
        strokeWidth={1.5}
      />
      <rect
        x={baseX + 6}
        y={baseY - 30}
        width={108}
        height={14}
        rx={3}
        fill={SCENE_PALETTE.hardwoodDark}
        stroke={SCENE_PALETTE.ink}
      />
      {/* Pole */}
      <rect
        x={poleX}
        y={baseY - 30 - poleHeight}
        width={14}
        height={poleHeight}
        fill={SCENE_PALETTE.inkSoft}
        stroke={SCENE_PALETTE.cream}
        strokeOpacity={0.4}
      />
      {/* Vane cluster */}
      {vanes.map(i => {
        const yPos = baseY - 30 - poleHeight + 30 + i * 14
        const swung = i < 4
        const length = 80 + i * 1.8
        return (
          <g key={`vane-${i}`}>
            <line
              x1={poleX + 14}
              y1={yPos}
              x2={poleX + 14 + length}
              y2={swung ? yPos - 4 : yPos}
              stroke={i % 2 === 0 ? SCENE_PALETTE.rim : SCENE_PALETTE.banner}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={swung ? 0.9 : 1}
            />
          </g>
        )
      })}
      {/* Reach scale label */}
      <text
        x={poleX + 110}
        y={baseY - 30 - poleHeight + 24}
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={20}
      >
        reach: 22&quot;
      </text>
      <HandLabel x={baseX + 60} y={baseY + 28}>
        vertec
      </HandLabel>
    </g>
  )
}

/**
 * Strip of tape measure pulled across the floor in front of the cones,
 * marked in feet. Reinforces the "measurables" theme without crowding the
 * floor with another piece of gear.
 */
function TapeMeasure() {
  const startX = 200
  const endX = 880
  const y = 760
  const ticks = [0, 5, 10, 15, 20]
  return (
    <g>
      <line
        x1={startX}
        y1={y}
        x2={endX}
        y2={y}
        stroke={SCENE_PALETTE.banner}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={startX}
        y1={y + 4}
        x2={endX}
        y2={y + 4}
        stroke={SCENE_PALETTE.ink}
        strokeOpacity={0.45}
        strokeWidth={1.5}
      />
      {ticks.map((tick, i) => {
        const x = startX + (i / (ticks.length - 1)) * (endX - startX)
        return (
          <g key={`tape-${tick}`}>
            <line
              x1={x}
              y1={y - 8}
              x2={x}
              y2={y + 8}
              stroke={SCENE_PALETTE.ink}
              strokeWidth={2}
            />
            <text
              x={x}
              y={y - 14}
              textAnchor="middle"
              fill={SCENE_PALETTE.cream}
              fontFamily={HANDWRITING_FONT}
              fontSize={16}
            >
              {tick}ft
            </text>
          </g>
        )
      })}
    </g>
  )
}
