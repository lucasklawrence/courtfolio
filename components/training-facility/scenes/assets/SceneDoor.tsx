import Link from 'next/link'

import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import { RoughCircle, RoughEllipse, RoughRect } from './rough-shapes'

/** Props for {@link SceneDoor}. */
export interface SceneDoorProps {
  /** Next.js link target — usually a sibling Training Facility route. */
  href: string
  /**
   * Accessible label for the wrapping anchor. Reads aloud for
   * keyboard / screen-reader users; sighted users see the overhead
   * sign + caption instead.
   */
  ariaLabel: string
  /**
   * Sign-board copy painted overhead (e.g. `"→ the gym"`). The arrow
   * is part of the string so each caller can customize the direction.
   */
  signText: string
  /**
   * Caption painted on the floor beneath the door (e.g. `"back door"`).
   * Defaults to `"back door"` since both current callers use it.
   */
  captionText?: string
  /** Left edge of the outer door frame, in viewBox units. */
  x: number
  /**
   * Base seed for the rough.js shapes. Each shape adds a small
   * deterministic offset (0–6) so re-renders stay visually stable.
   * Pick distinct seed bases per door so the two cross-link doors
   * don't share an identical sketch pattern.
   */
  seedBase: number
}

const DEFAULT_CAPTION = 'back door'

/** Outer frame width — both callers use this width. */
const FRAME_WIDTH = 200
/** Outer frame height. */
const FRAME_HEIGHT = 440
/** Inset between outer frame and inner door panel. */
const INSET_X = 16
/** Inset between inner panel and recessed sub-panels. */
const PANEL_INSET = 36

/**
 * Back-wall "spatial cross-link" door, shared between the Gym and
 * Combine scenes (#172 slice A; deduplicated per #176 follow-up).
 *
 * Renders the door frame, inset panel, hover/focus tint overlay,
 * recessed sub-panels, knob, underfoot spotlight, focus ring, and the
 * overhead sign — all wrapped in a Next.js `<Link>` so the spatial
 * connection is real navigation. Each caller supplies the route, sign
 * text, x-offset, and seed base; everything else (geometry, colors,
 * focus ring behavior) is held constant so a future cross-cutting
 * tweak (e.g. a chime sound, a different focus treatment) lands in
 * one place.
 *
 * The hover-tint overlay reads from {@link SCENE_PALETTE.hardwoodHover}
 * — single source of truth, no hex literals at the call site.
 */
export function SceneDoor({
  href,
  ariaLabel,
  signText,
  captionText = DEFAULT_CAPTION,
  x,
  seedBase,
}: SceneDoorProps) {
  // Anchor coords derived from `x` so the call site only needs to
  // supply the door's left edge. Frame opens at (x, 150) and ends at
  // (x + 200, 590); centerline at (x + 100). Sign sits a bit narrower
  // than the frame above it; spotlight sits a bit wider below.
  const centerX = x + FRAME_WIDTH / 2
  const innerX = x + INSET_X
  const innerWidth = FRAME_WIDTH - INSET_X * 2
  const panelInnerX = innerX + (PANEL_INSET - INSET_X)
  const panelInnerWidth = innerWidth - (PANEL_INSET - INSET_X) * 2
  const knobX = innerX + 32
  const focusRingX = x - 6
  const signX = x - 4

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group focus:outline-none"
    >
      {/* Door frame */}
      <RoughRect
        x={x}
        y={150}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={3}
        roughness={1.1}
        seed={seedBase}
      />
      {/* Inset door panel */}
      <RoughRect
        x={innerX}
        y={170}
        width={innerWidth}
        height={400}
        fill={SCENE_PALETTE.hardwoodMid}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={seedBase + 1}
      />
      {/* Hover/focus tint as a translucent overlay using existing classes */}
      <rect
        x={innerX}
        y={170}
        width={innerWidth}
        height={400}
        fill={SCENE_PALETTE.hardwoodHover}
        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      {/* Recessed inner panels */}
      <RoughRect
        x={panelInnerX}
        y={194}
        width={panelInnerWidth}
        height={150}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={seedBase + 2}
      />
      <RoughRect
        x={panelInnerX}
        y={364}
        width={panelInnerWidth}
        height={180}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={seedBase + 3}
      />
      {/* Door handle */}
      <RoughCircle
        cx={knobX}
        cy={380}
        r={5}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1}
        roughness={0.7}
        seed={seedBase + 4}
      />
      {/* Spotlight underfoot */}
      <RoughEllipse
        cx={centerX}
        cy={595}
        width={240}
        height={20}
        fill={SCENE_PALETTE.rim}
        fillStyle="solid"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={0.4}
        roughness={1.5}
        seed={seedBase + 5}
      />

      {/* Focus ring — visible only when the Link is keyboard-focused */}
      <rect
        x={focusRingX}
        y={144}
        width={FRAME_WIDTH + 12}
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
        x={signX}
        y={94}
        width={FRAME_WIDTH + 8}
        height={48}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={seedBase + 6}
      />
      <text
        x={centerX}
        y={128}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={26}
        fontWeight={700}
      >
        {signText}
      </text>
      <text
        x={centerX}
        y={636}
        textAnchor="middle"
        fill={SCENE_PALETTE.rimSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={20}
      >
        {captionText}
      </text>
    </Link>
  )
}
