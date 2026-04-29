import type { JSX } from 'react'

/**
 * Pose variant for the silhouette figure.
 *
 * - `'standing'`: relaxed pose with arms hanging at the sides. The figure's
 *   topmost point is the head crown — the dashed standing-reach line in §9.3
 *   sits *above* the head, marking where the fingertips would land if the
 *   arms were raised.
 * - `'apex'`: jump-apex pose with both arms extended overhead. The figure's
 *   topmost point is the fingertips; the head sits a few inches below.
 */
export type SilhouettePose = 'standing' | 'apex'

/** Props for {@link Silhouette}. */
export interface SilhouetteProps {
  /** Horizontal center of the figure in SVG units. */
  cx: number
  /** SVG-y of the topmost point — head crown for `'standing'`, fingertip for `'apex'`. Smaller = higher on canvas. */
  topY: number
  /** SVG-y of the foot bottom (the figure's contact line). Larger than `topY` since SVG y is down. */
  bottomY: number
  /** Pose variant. See {@link SilhouettePose}. */
  pose: SilhouettePose
  /** Fill color applied to every part of the figure. */
  color: string
  /** Optional fill opacity. Defaults to 1. */
  opacity?: number
}

/**
 * Ratio of body height (head crown to floor) to standing reach (fingertip
 * overhead to floor). NBA Combine measurements for ~6'1" players cluster
 * around 73"/80" ≈ 0.91. Used to compute where the head sits inside an
 * `'apex'` figure box, since the box extends from feet to fingertip and the
 * head is partway down from the top.
 */
const BODY_HEIGHT_TO_STANDING_REACH = 0.91

/**
 * Front-facing basketball player silhouette with two pose variants. Built
 * from a small set of filled SVG primitives (head ellipse, torso trapezoid,
 * two legs, two arms — all with rounded corners) so it renders crisply at
 * any scale and reads cleanly when stacked with other faded silhouettes.
 *
 * The figure is anchored from the (top, bottom) box: callers pass the SVG-y
 * of the topmost point (head crown for `'standing'`, fingertip for
 * `'apex'`) and the foot bottom; internal landmarks scale to fit. That
 * lets the §9.3 tracker think in body-position terms — feet at
 * `vertical_in` above the floor, fingertip at `vertical_in + standing reach`
 * — without doing pose-specific math at the call site.
 */
export function Silhouette({
  cx,
  topY,
  bottomY,
  pose,
  color,
  opacity = 1,
}: SilhouetteProps): JSX.Element {
  const figureH = bottomY - topY
  const isApex = pose === 'apex'

  // For an `'apex'` figure, the body (head crown to feet) is shorter than
  // the figure box because the box top is the fingertip, not the head. We
  // work in body-relative units so torso, head, and legs stay in proportion
  // regardless of pose.
  const bh = isApex ? figureH * BODY_HEIGHT_TO_STANDING_REACH : figureH
  const headTopY = bottomY - bh

  /** Y for a fraction `t` from the head crown (0) toward the feet (1). */
  const Y = (t: number): number => headTopY + t * bh

  // Vertical landmarks (fractions from head crown). Tuned for an athletic
  // basketball-player silhouette: ~13% head, ~22% torso, ~50% legs.
  const headBotY = Y(0.13)
  const shoulderY = Y(0.2)
  const hipY = Y(0.52)
  const handHangY = Y(0.5)
  const floorY = bottomY

  // Anatomical widths (front-facing). Numbers tuned by eye for a slim,
  // athletic-looking silhouette — wider feels chunky, narrower loses presence.
  const headRX = bh * 0.04
  const headRY = bh * 0.05
  const headCY = Y(0.055)
  const neckHalfW = bh * 0.018
  const shoulderHalfW = bh * 0.085
  const hipHalfW = bh * 0.055
  const armW = bh * 0.035
  const legW = bh * 0.05

  // Arm centerlines — anchored at the outer shoulder so the arm visually
  // grows out of the deltoid edge rather than the chest.
  const leftArmCx = cx - shoulderHalfW + armW * 0.5
  const rightArmCx = cx + shoulderHalfW - armW * 0.5

  // Leg centerlines — anchored to the outer hip with a small inner margin so
  // a thin gap is visible between the legs at the hip.
  const leftLegCx = cx - hipHalfW + legW * 0.5
  const rightLegCx = cx + hipHalfW - legW * 0.5

  // Torso: rounded trapezoid traced shoulder → hip → shoulder. The shoulder
  // edge curves slightly outward at the top to suggest deltoids, and the
  // hip edge tucks slightly inward to suggest the iliac crest.
  const torsoPath = [
    `M ${cx - shoulderHalfW} ${shoulderY}`,
    `Q ${cx} ${shoulderY - bh * 0.012}, ${cx + shoulderHalfW} ${shoulderY}`,
    `L ${cx + hipHalfW} ${hipY + bh * 0.005}`,
    `Q ${cx} ${hipY + bh * 0.022}, ${cx - hipHalfW} ${hipY + bh * 0.005}`,
    'Z',
  ].join(' ')

  return (
    <g fill={color} opacity={opacity}>
      {/* Legs (rendered first so torso overlaps them at the hip) */}
      <rect
        x={leftLegCx - legW / 2}
        y={hipY}
        width={legW}
        height={floorY - hipY}
        rx={legW * 0.3}
      />
      <rect
        x={rightLegCx - legW / 2}
        y={hipY}
        width={legW}
        height={floorY - hipY}
        rx={legW * 0.3}
      />

      {/* Torso */}
      <path d={torsoPath} />

      {/* Neck — small bridge between head and shoulders */}
      <rect
        x={cx - neckHalfW}
        y={headBotY}
        width={neckHalfW * 2}
        height={shoulderY - headBotY + bh * 0.01}
        rx={neckHalfW * 0.6}
      />

      {/* Head */}
      <ellipse cx={cx} cy={headCY} rx={headRX} ry={headRY} />

      {/* Arms — overhead for apex, hanging for standing */}
      {isApex ? (
        <>
          <rect
            x={leftArmCx - armW / 2}
            y={topY}
            width={armW}
            height={shoulderY - topY}
            rx={armW * 0.45}
          />
          <rect
            x={rightArmCx - armW / 2}
            y={topY}
            width={armW}
            height={shoulderY - topY}
            rx={armW * 0.45}
          />
        </>
      ) : (
        <>
          <rect
            x={leftArmCx - armW / 2}
            y={shoulderY}
            width={armW}
            height={handHangY - shoulderY}
            rx={armW * 0.45}
          />
          <rect
            x={rightArmCx - armW / 2}
            y={shoulderY}
            width={armW}
            height={handHangY - shoulderY}
            rx={armW * 0.45}
          />
        </>
      )}
    </g>
  )
}
