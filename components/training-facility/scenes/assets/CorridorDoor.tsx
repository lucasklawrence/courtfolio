import Link from 'next/link'

import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'

/** A single point in scene viewBox units. */
export interface Point {
  /** X coordinate in viewBox units. */
  x: number
  /** Y coordinate in viewBox units. */
  y: number
}

/**
 * The four corners of a foreshortened door panel, ordered clockwise
 * starting from the top-outer corner: `[topOuter, topInner, bottomInner,
 * bottomOuter]`. "Outer" is the edge nearer the viewer (screen edge),
 * "inner" the edge nearer the vanishing point. A front-facing door at
 * the end of the hall is just the degenerate case where the two top
 * corners share a y and the two bottom corners share a y.
 */
export type DoorCorners = [Point, Point, Point, Point]

/** Props for {@link CorridorDoor}. */
export interface CorridorDoorProps {
  /** Next.js route this doorway opens onto. */
  href: string
  /**
   * Accessible label for the wrapping anchor. Sighted users read the
   * painted overhead sign; screen-reader / keyboard users hear this.
   */
  ariaLabel: string
  /** Sign-board copy painted overhead (e.g. `"The Gym"`). */
  title: string
  /** Optional smaller caption under the sign board (e.g. `"cardio wing"`). */
  subtitle?: string
  /**
   * The door panel's four corners in viewBox units, clockwise from the
   * top-outer corner. Callers compute these from the corridor's
   * perspective so each door sits flush in its wall.
   */
  corners: DoorCorners
  /** Center point of the overhead sign board, in viewBox units. */
  label: Point
  /** Panel fill color. Defaults to the hardwood-mid plank tone. */
  fill?: string
}

/** Average of a list of points — used for the panel centroid. */
function centroidOf(points: readonly Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

/**
 * Move `p` toward `target` by `dist` viewBox units. A negative `dist`
 * pushes away from the target instead. Used to inset the recessed panel
 * and outset the focus ring relative to the door centroid.
 */
function nudge(p: Point, target: Point, dist: number): Point {
  const dx = target.x - p.x
  const dy = target.y - p.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return p
  return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist }
}

/** Serialize corners into an SVG `points` attribute string. */
function toPoints(corners: readonly Point[]): string {
  return corners.map(p => `${p.x},${p.y}`).join(' ')
}

/**
 * A navigable, perspective-foreshortened door set into a corridor wall.
 *
 * Renders the door panel, a recessed inner panel, a knob, a hover/focus
 * tint overlay, a dashed keyboard-focus ring, and an overhead sign —
 * all wrapped in a Next.js `<Link>` so walking through the door is real
 * navigation. Geometry is fully driven by {@link CorridorDoorProps.corners}
 * so the same component draws both the foreshortened side-wall doors and
 * the front-facing door at the end of the hall.
 *
 * Mirrors the interaction affordances used across the Training Facility
 * scenes (`GymScene`, `SceneDoor`): a translucent cream hover tint and a
 * rim-orange dashed focus ring that only appear on hover / keyboard focus,
 * so the resting scene stays clean.
 *
 * @param props.href - Route the doorway opens onto.
 * @param props.ariaLabel - Accessible name for the wrapping anchor.
 * @param props.title - Overhead sign-board text.
 * @param props.subtitle - Optional caption under the sign board.
 * @param props.corners - Door panel corners, clockwise from top-outer.
 * @param props.label - Center of the overhead sign board.
 * @param props.fill - Panel fill color; defaults to the hardwood-mid tone.
 */
export function CorridorDoor({
  href,
  ariaLabel,
  title,
  subtitle,
  corners,
  label,
  fill = SCENE_PALETTE.hardwoodMid,
}: CorridorDoorProps) {
  const centroid = centroidOf(corners)
  const panelPoints = toPoints(corners)
  const innerPoints = toPoints(corners.map(p => nudge(p, centroid, 18)))
  const focusPoints = toPoints(corners.map(p => nudge(p, centroid, -8)))

  // Knob on the inner (vanishing-point-facing) stile, nudged toward the
  // panel center so it reads as sitting on the door face.
  const innerEdgeMid = {
    x: (corners[1].x + corners[2].x) / 2,
    y: (corners[1].y + corners[2].y) / 2,
  }
  const knob = nudge(innerEdgeMid, centroid, 22)

  // Sign board sized to the title; kept horizontal (billboard) so the
  // copy stays legible regardless of the wall's foreshortening.
  const boardWidth = Math.max(120, title.length * 15 + 28)
  const boardHeight = 42

  return (
    <Link href={href} aria-label={ariaLabel} className="group focus:outline-none">
      {/* Door panel */}
      <polygon
        points={panelPoints}
        fill={fill}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Recessed inner panel — a ghost stroke gives the door some depth. */}
      <polygon
        points={innerPoints}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeOpacity={0.5}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Knob */}
      <circle
        cx={knob.x}
        cy={knob.y}
        r={6}
        fill={SCENE_PALETTE.banner}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
      />
      {/* Hover / focus tint overlay */}
      <polygon
        points={panelPoints}
        fill={SCENE_PALETTE.creamBright}
        className="opacity-0 transition-opacity group-hover:opacity-10 group-focus-visible:opacity-15"
      />
      {/* Focus ring — visible only when the Link is keyboard-focused. */}
      <polygon
        points={focusPoints}
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={4}
        strokeDasharray="6 4"
        strokeLinejoin="round"
        className="opacity-0 transition-opacity group-focus-visible:opacity-100"
      />

      {/* Overhead sign board */}
      <rect
        x={label.x - boardWidth / 2}
        y={label.y - boardHeight / 2}
        width={boardWidth}
        height={boardHeight}
        rx={6}
        fill={SCENE_PALETTE.banner}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
      />
      <text
        x={label.x}
        y={label.y + 8}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={26}
        fontWeight={700}
      >
        {title}
      </text>
      {subtitle ? (
        <text
          x={label.x}
          y={label.y + boardHeight / 2 + 22}
          textAnchor="middle"
          fill={SCENE_PALETTE.rimSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={18}
        >
          {subtitle}
        </text>
      ) : null}
    </Link>
  )
}
