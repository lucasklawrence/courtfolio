import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughCircle,
  RoughEllipse,
  RoughLineShape,
  RoughPath,
  RoughRect,
} from './rough-shapes'

/**
 * White sweat towel draped over the treadmill side rail. Tilted so it folds
 * down off the rail in two visible panels.
 */
export function SweatTowel() {
  return (
    <g aria-hidden="true">
      {/* Front panel of the towel */}
      <RoughPath
        d="M 188 760 L 234 760 L 240 826 L 196 832 Z"
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={1.8}
        roughness={1.4}
        bowing={1.5}
        seed={800}
      />
      {/* Fold lines */}
      <RoughLineShape
        x1={210}
        y1={764}
        x2={216}
        y2={830}
        stroke={SCENE_PALETTE.hardwoodDark}
        strokeWidth={0.8}
        roughness={1.2}
        seed={801}
      />
      <RoughLineShape
        x1={224}
        y1={764}
        x2={228}
        y2={830}
        stroke={SCENE_PALETTE.hardwoodDark}
        strokeWidth={0.6}
        roughness={1.0}
        seed={802}
      />
      {/* Stripe near the bottom */}
      <RoughLineShape
        x1={196}
        y1={815}
        x2={240}
        y2={812}
        stroke={SCENE_PALETTE.rim}
        strokeWidth={2}
        roughness={1.0}
        seed={803}
      />
    </g>
  )
}

/**
 * Reusable water bottle / Gatorade tumbler. Color tokens come from the
 * caller so the Gym version (orange-cap) and the Combine Gatorade
 * (yellow-body) reuse the same shape with different palettes.
 */
type WaterBottleProps = {
  /** Top-left x of the bottle's bounding box. */
  x: number
  /** Top-left y of the bottle's bounding box. */
  y: number
  /** Body color. */
  bodyFill: string
  /** Cap color. */
  capFill: string
  /** Optional label color. */
  labelFill?: string
  /** Optional 3-letter or single-character mark on the label. */
  mark?: string
  /** Determinism seed offset. */
  seed: number
}

/**
 * Squat sport bottle — used for both the Gym water bottle and the Combine
 * Gatorade. Cap, body, label band, and a small reflection highlight.
 *
 * @param props.x - Top-left x of the bottle's bounding box.
 * @param props.y - Top-left y of the bottle's bounding box.
 * @param props.bodyFill - Body color.
 * @param props.capFill - Cap color.
 * @param props.labelFill - Label band color. Defaults to cream.
 * @param props.mark - Optional 1-3 character mark printed on the label.
 * @param props.seed - Stable rough-stroke seed offset.
 */
export function WaterBottle({
  x,
  y,
  bodyFill,
  capFill,
  labelFill = SCENE_PALETTE.cream,
  mark,
  seed,
}: WaterBottleProps) {
  return (
    <g aria-hidden="true">
      {/* Cap */}
      <RoughRect
        x={x + 8}
        y={y}
        width={20}
        height={10}
        fill={capFill}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.2}
        roughness={0.8}
        seed={seed}
      />
      {/* Neck */}
      <RoughRect
        x={x + 12}
        y={y + 10}
        width={12}
        height={6}
        fill={bodyFill}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.2}
        roughness={0.8}
        seed={seed + 1}
      />
      {/* Body */}
      <RoughRect
        x={x}
        y={y + 16}
        width={36}
        height={48}
        fill={bodyFill}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={1.0}
        seed={seed + 2}
      />
      {/* Label */}
      <RoughRect
        x={x + 2}
        y={y + 30}
        width={32}
        height={20}
        fill={labelFill}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1}
        roughness={0.7}
        seed={seed + 3}
      />
      {mark && (
        <text
          x={x + 18}
          y={y + 45}
          textAnchor="middle"
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={11}
          fontWeight={700}
        >
          {mark}
        </text>
      )}
      {/* Reflection highlight */}
      <RoughLineShape
        x1={x + 4}
        y1={y + 18}
        x2={x + 4}
        y2={y + 60}
        stroke={SCENE_PALETTE.creamBright}
        strokeWidth={1.5}
        roughness={0.5}
        seed={seed + 4}
      />
    </g>
  )
}

/**
 * Basketball with the typical 8-segment line pattern visible from one
 * side. Caller positions it with a wrapping `<g transform>` if needed.
 *
 * @param props.cx - Ball center x.
 * @param props.cy - Ball center y.
 * @param props.r - Ball radius.
 * @param props.seed - Stable rough-stroke seed offset.
 */
export function Basketball({
  cx,
  cy,
  r,
  seed,
}: {
  cx: number
  cy: number
  r: number
  seed: number
}) {
  return (
    <g aria-hidden="true">
      {/* Cast shadow */}
      <RoughEllipse
        cx={cx}
        cy={cy + r}
        width={r * 2}
        height={r * 0.5}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={1.4}
        seed={seed}
      />
      {/* Ball */}
      <RoughCircle
        cx={cx}
        cy={cy}
        r={r}
        fill={SCENE_PALETTE.rim}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.8}
        roughness={1.0}
        seed={seed + 1}
      />
      {/* Vertical seam */}
      <RoughPath
        d={`M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy} ${cx} ${cy + r}`}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={1.0}
        bowing={1.2}
        seed={seed + 2}
      />
      {/* Horizontal seam */}
      <RoughPath
        d={`M ${cx - r} ${cy} Q ${cx} ${cy + r * 0.18} ${cx + r} ${cy}`}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={1.0}
        bowing={1.2}
        seed={seed + 3}
      />
      {/* Side seam (curve from upper-left to lower-right) */}
      <RoughPath
        d={`M ${cx - r * 0.7} ${cy - r * 0.7} Q ${cx} ${cy - r * 0.2} ${cx + r * 0.7} ${cy - r * 0.7}`}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.2}
        roughness={1.0}
        bowing={1.5}
        seed={seed + 4}
      />
      {/* Highlight */}
      <RoughEllipse
        cx={cx - r * 0.4}
        cy={cy - r * 0.5}
        width={r * 0.5}
        height={r * 0.3}
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={1.0}
        seed={seed + 5}
      />
    </g>
  )
}

/**
 * Pair of sneakers shown in profile, sitting on the floor. Used in the
 * Combine to make the staging floor feel inhabited.
 *
 * @param props.x - Anchor x of the heel of the back sneaker.
 * @param props.y - Floor y the sneakers rest on.
 * @param props.seed - Stable rough-stroke seed offset.
 */
export function Sneakers({
  x,
  y,
  seed,
}: {
  x: number
  y: number
  seed: number
}) {
  return (
    <g aria-hidden="true">
      {/* Cast shadow */}
      <RoughEllipse
        cx={x + 60}
        cy={y + 4}
        width={140}
        height={8}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={1.5}
        seed={seed}
      />

      {/* Back sneaker (visible heel + side) */}
      <RoughPath
        d={`M ${x} ${y - 6} Q ${x + 4} ${y - 22} ${x + 30} ${y - 22} Q ${x + 60} ${y - 18} ${x + 70} ${y - 4} L ${x + 70} ${y} L ${x} ${y} Z`}
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.2}
        seed={seed + 1}
      />
      {/* Sole stripe */}
      <RoughRect
        x={x}
        y={y - 4}
        width={70}
        height={4}
        fill={SCENE_PALETTE.rim}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1}
        roughness={0.7}
        seed={seed + 2}
      />
      {/* Laces */}
      {[0, 1, 2].map(i => (
        <RoughLineShape
          key={`lace-back-${i}`}
          x1={x + 30 + i * 10}
          y1={y - 22 + i * 2}
          x2={x + 38 + i * 10}
          y2={y - 22 + i * 2}
          stroke={SCENE_PALETTE.inkSoft}
          strokeWidth={1.2}
          roughness={0.6}
          seed={seed + 3 + i}
        />
      ))}
      {/* Logo swoosh */}
      <RoughPath
        d={`M ${x + 18} ${y - 8} Q ${x + 30} ${y - 16} ${x + 50} ${y - 10}`}
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={1.5}
        roughness={1.0}
        bowing={1.5}
        seed={seed + 8}
      />

      {/* Front sneaker — slightly forward and right */}
      <RoughPath
        d={`M ${x + 56} ${y - 6} Q ${x + 60} ${y - 22} ${x + 86} ${y - 22} Q ${x + 116} ${y - 18} ${x + 126} ${y - 4} L ${x + 126} ${y} L ${x + 56} ${y} Z`}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.2}
        seed={seed + 10}
      />
      <RoughRect
        x={x + 56}
        y={y - 4}
        width={70}
        height={4}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1}
        roughness={0.7}
        seed={seed + 11}
      />
      {[0, 1, 2].map(i => (
        <RoughLineShape
          key={`lace-front-${i}`}
          x1={x + 86 + i * 10}
          y1={y - 22 + i * 2}
          x2={x + 94 + i * 10}
          y2={y - 22 + i * 2}
          stroke={SCENE_PALETTE.inkSoft}
          strokeWidth={1.2}
          roughness={0.6}
          seed={seed + 12 + i}
        />
      ))}
    </g>
  )
}

/**
 * A small chalk-puff cloud near the Vertec base — leftover residue from a
 * jumper chalking up. Just three offset clouds in cream.
 *
 * @param props.x - Anchor x.
 * @param props.y - Anchor y (floor contact).
 * @param props.seed - Stable rough-stroke seed offset.
 */
export function ChalkPuff({
  x,
  y,
  seed,
}: {
  x: number
  y: number
  seed: number
}) {
  return (
    <g aria-hidden="true" opacity={0.8}>
      <RoughCircle cx={x} cy={y} r={10} fill={SCENE_PALETTE.creamBright} fillStyle="solid" stroke={SCENE_PALETTE.cream} strokeWidth={0.8} roughness={1.6} seed={seed} />
      <RoughCircle cx={x + 12} cy={y - 6} r={8} fill={SCENE_PALETTE.creamBright} fillStyle="solid" stroke={SCENE_PALETTE.cream} strokeWidth={0.8} roughness={1.6} seed={seed + 1} />
      <RoughCircle cx={x - 10} cy={y - 5} r={7} fill={SCENE_PALETTE.creamBright} fillStyle="solid" stroke={SCENE_PALETTE.cream} strokeWidth={0.8} roughness={1.6} seed={seed + 2} />
      <RoughCircle cx={x + 4} cy={y + 4} r={6} fill={SCENE_PALETTE.creamBright} fillStyle="solid" stroke={SCENE_PALETTE.cream} strokeWidth={0.8} roughness={1.6} seed={seed + 3} />
    </g>
  )
}
