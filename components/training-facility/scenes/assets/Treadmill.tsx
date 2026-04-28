import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughCircle,
  RoughEllipse,
  RoughLineShape,
  RoughPath,
  RoughRect,
} from './rough-shapes'

/**
 * Side-on treadmill — long deck with rounded rollers at each end, a console
 * upright at the front, vertical handlebars, and a side rail along the deck.
 *
 * Phase 1 build: decorative only.
 */
export function Treadmill() {
  // Floor contact at y = 820
  return (
    <g aria-hidden="true">
      {/* Cast shadow */}
      <RoughEllipse
        cx={290}
        cy={820}
        width={340}
        height={20}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={0.5}
        roughness={1.6}
        seed={51}
      />

      {/* Front roller (left, smaller) */}
      <RoughCircle
        cx={150}
        cy={780}
        r={20}
        fill={SCENE_PALETTE.cream}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={52}
      />
      <RoughCircle
        cx={150}
        cy={780}
        r={6}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1}
        roughness={0.7}
        seed={53}
      />

      {/* Rear roller (right, motor housing) */}
      <RoughRect
        x={420}
        y={750}
        width={70}
        height={60}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.2}
        seed={54}
      />
      {/* Motor housing top vent */}
      {[0, 1, 2, 3].map(i => (
        <RoughLineShape
          key={`vent-${i}`}
          x1={428 + i * 15}
          y1={758}
          x2={438 + i * 15}
          y2={758}
          stroke={SCENE_PALETTE.cream}
          strokeWidth={1.5}
          roughness={0.6}
          seed={55 + i}
        />
      ))}

      {/* Deck (belt visible side-on as a flat plane) */}
      <RoughPath
        d="M 150 770 L 420 770 L 420 800 L 150 800 Z"
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={60}
      />
      {/* Belt traction lines */}
      {Array.from({ length: 12 }).map((_, i) => (
        <RoughLineShape
          key={`belt-${i}`}
          x1={170 + i * 22}
          y1={774}
          x2={170 + i * 22}
          y2={798}
          stroke={SCENE_PALETTE.cream}
          strokeWidth={1}
          roughness={0.5}
          seed={61 + i}
        />
      ))}

      {/* Side rail (cream metal trim along the top of the deck) */}
      <RoughRect
        x={140}
        y={760}
        width={290}
        height={8}
        fill={SCENE_PALETTE.cream}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.8}
        seed={75}
      />

      {/* Console upright */}
      <RoughRect
        x={400}
        y={500}
        width={20}
        height={260}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={76}
      />

      {/* Console housing */}
      <RoughRect
        x={345}
        y={460}
        width={130}
        height={100}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.1}
        seed={77}
      />
      {/* Screen */}
      <RoughRect
        x={358}
        y={472}
        width={104}
        height={56}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={1.5}
        roughness={0.7}
        seed={78}
      />
      <text
        x={410}
        y={498}
        textAnchor="middle"
        fill={SCENE_PALETTE.rimSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={15}
      >
        pace
      </text>
      <text
        x={410}
        y={522}
        textAnchor="middle"
        fill={SCENE_PALETTE.creamBright}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
        fontWeight={700}
      >
        9:42
      </text>
      {/* Console buttons */}
      {[0, 1, 2, 3].map(i => (
        <RoughCircle
          key={`btn-${i}`}
          cx={363 + i * 28}
          cy={544}
          r={5}
          fill={i === 1 ? SCENE_PALETTE.rim : SCENE_PALETTE.cream}
          fillStyle="solid"
          stroke={SCENE_PALETTE.ink}
          strokeWidth={1}
          roughness={0.6}
          seed={79 + i}
        />
      ))}

      {/* Front handlebar — vertical post + horizontal cross-bar */}
      <RoughPath
        d="M 360 460 L 360 410 L 460 410 L 460 460"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={5}
        roughness={1.0}
        bowing={1.2}
        seed={84}
      />
      {/* Hand grips */}
      <RoughRect x={345} y={406} width={30} height={12} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={1.0} seed={85} />
      <RoughRect x={445} y={406} width={30} height={12} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={1.0} seed={86} />

      {/* Emergency stop key — red dot above screen */}
      <RoughCircle cx={356} cy={464} r={4} fill={SCENE_PALETTE.rim} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1} roughness={0.6} seed={87} />

      {/* Brand strip on side rail */}
      <text
        x={285}
        y={767}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={12}
        fontWeight={700}
        letterSpacing="0.32em"
      >
        FAST·LANE
      </text>

      {/* Caption */}
      <text
        x={285}
        y={862}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        treadmill
      </text>
    </g>
  )
}
