import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughCircle,
  RoughEllipse,
  RoughPath,
  RoughRect,
} from './rough-shapes'

/**
 * Centerpiece of the Gym scene — a side-on stair climber. Heavy base, tall
 * body column with a console at the top, two offset pedals showing the
 * machine mid-stride, and forward-curving handrails to either side.
 *
 * Phase 1 build: decorative only. Caller positions via wrapping `<g transform>`.
 */
export function StairClimber() {
  // Anchor the entire piece around (730, 820) — the floor contact point.
  const baseY = 820

  return (
    <g aria-hidden="true">
      {/* Cast shadow on the floor */}
      <RoughEllipse
        cx={730}
        cy={baseY + 8}
        width={340}
        height={26}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={0.5}
        roughness={1.6}
        seed={11}
      />

      {/* Heavy base footprint */}
      <RoughRect
        x={580}
        y={baseY - 30}
        width={300}
        height={36}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.2}
        seed={12}
      />
      {/* Front lip detail on base */}
      <RoughRect
        x={590}
        y={baseY - 38}
        width={280}
        height={10}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={1.0}
        seed={13}
      />

      {/* Body column — tilted slightly back, like the machine leans into the climber */}
      <RoughPath
        d="M 660 800 L 666 420 L 800 420 L 808 800 Z"
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.3}
        seed={14}
      />
      {/* Body highlight strip — catches the wall light */}
      <RoughPath
        d="M 670 790 L 675 430 L 690 430 L 685 790 Z"
        fill={SCENE_PALETTE.cream}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={0.8}
        seed={15}
      />

      {/* Console at top — chunkier than v1 */}
      <RoughRect
        x={648}
        y={400}
        width={170}
        height={48}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.0}
        seed={16}
      />
      {/* Console screen */}
      <RoughRect
        x={660}
        y={410}
        width={146}
        height={28}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={1.5}
        roughness={0.7}
        seed={17}
      />
      <text
        x={733}
        y={432}
        textAnchor="middle"
        fill={SCENE_PALETTE.creamBright}
        fontFamily={HANDWRITING_FONT}
        fontSize={18}
        fontWeight={700}
      >
        84 spm
      </text>

      {/* Display strip showing program / level on the body */}
      <RoughRect
        x={678}
        y={470}
        width={114}
        height={26}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.9}
        seed={18}
      />
      <text
        x={735}
        y={488}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={15}
        fontWeight={700}
      >
        zone 3 — climb
      </text>

      {/* Status LEDs */}
      <RoughCircle cx={680} cy={518} r={4} fill={SCENE_PALETTE.rim} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1} roughness={0.6} seed={19} />
      <RoughCircle cx={695} cy={518} r={4} fill={SCENE_PALETTE.banner} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1} roughness={0.6} seed={20} />
      <RoughCircle cx={710} cy={518} r={4} fill={SCENE_PALETTE.cream} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1} roughness={0.6} seed={21} />

      {/* Pedals — one up-position, one down-position, mid-stride */}
      {/* Left pedal (up) */}
      <RoughPath
        d="M 540 600 L 660 580 L 660 612 L 540 632 Z"
        fill={SCENE_PALETTE.hardwoodLight}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.2}
        seed={22}
      />
      {/* Foot grip ridges on left pedal */}
      {[0, 1, 2, 3, 4].map(i => (
        <RoughPath
          key={`grip-l-${i}`}
          d={`M ${554 + i * 20} ${622 - i * 3.5} L ${564 + i * 20} ${618 - i * 3.5}`}
          stroke={SCENE_PALETTE.ink}
          strokeWidth={1.2}
          fill="none"
          roughness={0.9}
          seed={23 + i}
        />
      ))}
      {/* Right pedal (down) */}
      <RoughPath
        d="M 800 670 L 920 690 L 920 720 L 800 700 Z"
        fill={SCENE_PALETTE.hardwoodLight}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.2}
        seed={32}
      />
      {/* Foot grip ridges on right pedal */}
      {[0, 1, 2, 3, 4].map(i => (
        <RoughPath
          key={`grip-r-${i}`}
          d={`M ${814 + i * 20} ${694 + i * 3.5} L ${824 + i * 20} ${698 + i * 3.5}`}
          stroke={SCENE_PALETTE.ink}
          strokeWidth={1.2}
          fill="none"
          roughness={0.9}
          seed={33 + i}
        />
      ))}

      {/* Handrails curving forward from body — cream (hardware metal) */}
      <RoughPath
        d="M 660 540 Q 600 540 555 580 Q 525 605 525 660"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={6}
        roughness={1.0}
        bowing={1.5}
        seed={42}
      />
      <RoughPath
        d="M 800 540 Q 860 540 905 580 Q 935 605 935 660"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={6}
        roughness={1.0}
        bowing={1.5}
        seed={43}
      />
      {/* Hand-grip wraps */}
      <RoughRect x={510} y={655} width={30} height={14} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={1.0} seed={44} />
      <RoughRect x={920} y={655} width={30} height={14} fill={SCENE_PALETTE.inkSoft} fillStyle="solid" stroke={SCENE_PALETTE.ink} strokeWidth={1.5} roughness={1.0} seed={45} />

      {/* Brand logo strip near base */}
      <text
        x={730}
        y={788}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={16}
        fontWeight={700}
        letterSpacing="0.3em"
      >
        STEP·MILL
      </text>

      {/* Caption */}
      <text
        x={730}
        y={868}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        stair climber
      </text>
    </g>
  )
}
