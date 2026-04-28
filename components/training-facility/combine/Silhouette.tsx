import type { JSX } from 'react'

/** Props for {@link Silhouette}. */
export interface SilhouetteProps {
  /** Horizontal center of the figure in SVG units. */
  cx: number
  /** SVG-y of the fingertip (top of the raised arm). Smaller = higher on the canvas. */
  topY: number
  /** SVG-y of the foot bottom (the figure's contact line). Larger than `topY` since SVG y is down. */
  bottomY: number
  /** Fill color applied to every part of the figure. */
  color: string
  /** Optional fill opacity. Defaults to 1. */
  opacity?: number
}

/**
 * Side-profile basketball player silhouette posed at the apex of a jump:
 * one arm extended overhead so the fingertip aligns with the figure's
 * topmost point. Composed of simple filled SVG primitives (head circle,
 * arm/torso/legs paths) so it stays crisp at any scale and reads
 * cleanly when faded behind newer silhouettes.
 *
 * The figure is anchored from the fingertip → feet line: pass the SVG-y
 * of those two points and the component handles all internal proportions.
 * That anchoring matters because PRD §9.3 places frozen jumps with
 * `feet at vertical_in above the floor` and `fingertip at vertical_in + standing reach`,
 * so callers think in body-position terms, not in figure metrics.
 */
export function Silhouette({
  cx,
  topY,
  bottomY,
  color,
  opacity = 1,
}: SilhouetteProps): JSX.Element {
  const h = bottomY - topY

  // Vertical landmarks, all expressed as fractions from fingertip (0)
  // to floor (1). The numbers are tuned by hand for a recognizable
  // side-profile basketball-player silhouette and aren't load-bearing
  // beyond visual fidelity — adjust freely.
  const fingertipY = topY
  const elbowY = topY + 0.16 * h
  const shoulderY = topY + 0.26 * h
  const headCY = topY + 0.18 * h
  const hipY = topY + 0.5 * h
  const kneeY = topY + 0.72 * h
  const ankleY = topY + 0.94 * h
  const floorY = bottomY

  const armW = h * 0.04
  const torsoW = h * 0.085
  const legW = h * 0.05
  const headR = h * 0.055
  const headCX = cx - h * 0.025

  const armPath = [
    `M ${cx - armW / 2} ${fingertipY}`,
    `L ${cx + armW / 2} ${fingertipY}`,
    `L ${cx + armW / 2 + h * 0.012} ${elbowY}`,
    `L ${cx + armW / 2 + h * 0.005} ${shoulderY}`,
    `L ${cx - armW / 2} ${shoulderY}`,
    `L ${cx - armW / 2 - h * 0.005} ${elbowY}`,
    'Z',
  ].join(' ')

  const torsoPath = [
    `M ${cx - torsoW / 2} ${shoulderY}`,
    `L ${cx + torsoW / 2} ${shoulderY}`,
    `L ${cx + torsoW / 2 + h * 0.005} ${hipY}`,
    `L ${cx - torsoW / 2 - h * 0.005} ${hipY}`,
    'Z',
  ].join(' ')

  const backLegPath = [
    `M ${cx - torsoW / 2} ${hipY}`,
    `L ${cx - torsoW / 2 - h * 0.025} ${kneeY}`,
    `L ${cx - torsoW / 2 - h * 0.045} ${ankleY}`,
    `L ${cx - torsoW / 2 - h * 0.055} ${floorY}`,
    `L ${cx - torsoW / 2 + legW * 0.4} ${floorY}`,
    `L ${cx - torsoW / 2 + legW * 0.4} ${kneeY}`,
    'Z',
  ].join(' ')

  const frontLegPath = [
    `M ${cx + torsoW / 2} ${hipY}`,
    `L ${cx + torsoW / 2 + h * 0.03} ${kneeY}`,
    `L ${cx + torsoW / 2 + h * 0.055} ${ankleY}`,
    `L ${cx + torsoW / 2 + h * 0.07} ${floorY}`,
    `L ${cx + torsoW / 2 - legW * 0.4} ${floorY}`,
    `L ${cx + torsoW / 2 - legW * 0.4} ${kneeY}`,
    'Z',
  ].join(' ')

  return (
    <g fill={color} opacity={opacity}>
      <path d={armPath} />
      <circle cx={headCX} cy={headCY} r={headR} />
      <path d={torsoPath} />
      <path d={backLegPath} />
      <path d={frontLegPath} />
    </g>
  )
}
