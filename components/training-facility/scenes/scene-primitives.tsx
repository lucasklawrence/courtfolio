import type { ReactNode } from 'react'

/**
 * Court Vision palette tokens used across the Training Facility scenes.
 *
 * Mirrors `docs/design-system.md` and the courtfolio brand:
 * hardwood browns for floors and equipment frames, court-line cream
 * for highlights and chalk, rim-orange for accents, ink-black for
 * outlines and the back-of-room gradient.
 */
export const SCENE_PALETTE = {
  /** Deep ink for the back wall and high-contrast outlines. */
  ink: '#0f0907',
  /** Slightly warmer ink for primary stroke work on equipment. */
  inkSoft: '#1a1208',
  /** Hardwood plank dark — used for the floor base and equipment frames. */
  hardwoodDark: '#42210b',
  /** Hardwood plank mid — the dominant floor tone. */
  hardwoodMid: '#5a3015',
  /** Hardwood plank light — the lit edge of each plank. */
  hardwoodLight: '#8a5a2a',
  /** Wall band — the warm hue that sits behind equipment. */
  wallWarm: '#241811',
  /** Wall highlight band where the spotlight catches it. */
  wallHighlight: '#3a241a',
  /** Court-line cream — labels, chalk, signage. */
  cream: '#f7ead9',
  /** Brighter cream for highlights on cream surfaces. */
  creamBright: '#fff7ec',
  /** Rim-orange primary accent. */
  rim: '#ea580c',
  /** Rim-orange hover/light accent. */
  rimSoft: '#fdba74',
  /** Banner yellow — used sparingly on signage. */
  banner: '#fde047',
  /** Whiteboard surface tint. */
  whiteboard: '#f3ecdf',
} as const

/**
 * Tailwind-safe font stack for the Patrick Hand handwriting accent used inside
 * SVG `<text>` elements. The repo loads Patrick Hand via the `font-handwriting`
 * Tailwind alias and falls back to the system cursive face when the web font
 * has not loaded yet, so the same fallback chain is repeated here for SVG.
 */
export const HANDWRITING_FONT = '"Patrick Hand", "Comic Sans MS", cursive'

/**
 * Props for {@link HardwoodFloor}.
 */
type HardwoodFloorProps = {
  /** Top edge of the floor band, in viewBox units. */
  y: number
  /** Total height of the floor band, in viewBox units. */
  height: number
  /** Width of the floor band, in viewBox units. */
  width: number
  /** Number of vertical plank seams to render across the width. Defaults to 9. */
  plankCount?: number
}

/**
 * Side-on hardwood floor band rendered as vertical planks with a warm
 * gradient. Used as the floor of every Training Facility sub-area scene so
 * the rooms read as continuous spaces.
 *
 * @param props.y - Top edge of the floor band, in viewBox units.
 * @param props.height - Total height of the floor band, in viewBox units.
 * @param props.width - Width of the floor band, in viewBox units.
 * @param props.plankCount - Number of vertical plank seams. Defaults to 9.
 */
export function HardwoodFloor({ y, height, width, plankCount = 9 }: HardwoodFloorProps) {
  const plankWidth = width / plankCount
  const seams = Array.from({ length: plankCount - 1 }, (_, i) => (i + 1) * plankWidth)

  return (
    <g aria-hidden="true">
      <rect x={0} y={y} width={width} height={height} fill="url(#sceneHardwood)" />
      {seams.map(x => (
        <line
          key={`seam-${x}`}
          x1={x}
          y1={y}
          x2={x}
          y2={y + height}
          stroke={SCENE_PALETTE.hardwoodDark}
          strokeOpacity={0.55}
          strokeWidth={1.4}
        />
      ))}
      {/* A baseline shadow that grounds the room. */}
      <rect
        x={0}
        y={y}
        width={width}
        height={Math.min(8, height * 0.04)}
        fill={SCENE_PALETTE.ink}
        fillOpacity={0.55}
      />
    </g>
  )
}

/**
 * Props for {@link WallBand}.
 */
type WallBandProps = {
  /** Width of the wall band, in viewBox units. */
  width: number
  /** Height of the wall band, in viewBox units. */
  height: number
}

/**
 * Back-wall band rendered behind a Training Facility scene. The gradient mirrors
 * the warm-spotlight-on-charcoal look used across the courtfolio.
 *
 * @param props.width - Width of the band, in viewBox units.
 * @param props.height - Height of the band, in viewBox units.
 */
export function WallBand({ width, height }: WallBandProps) {
  return (
    <g aria-hidden="true">
      <rect x={0} y={0} width={width} height={height} fill="url(#sceneWall)" />
      {/* Chair-rail trim where wall meets floor. */}
      <rect
        x={0}
        y={height - 6}
        width={width}
        height={6}
        fill={SCENE_PALETTE.hardwoodDark}
        opacity={0.85}
      />
    </g>
  )
}

/**
 * Shared `<defs>` block that supplies the gradients used by {@link WallBand}
 * and {@link HardwoodFloor}. Render this once near the top of each scene SVG.
 */
export function SceneDefs() {
  return (
    <defs>
      <linearGradient id="sceneWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={SCENE_PALETTE.wallHighlight} />
        <stop offset="55%" stopColor={SCENE_PALETTE.wallWarm} />
        <stop offset="100%" stopColor={SCENE_PALETTE.ink} />
      </linearGradient>
      <radialGradient id="sceneSpotlight" cx="0.5" cy="0" r="0.8">
        <stop offset="0%" stopColor={SCENE_PALETTE.rimSoft} stopOpacity={0.18} />
        <stop offset="60%" stopColor={SCENE_PALETTE.rimSoft} stopOpacity={0.04} />
        <stop offset="100%" stopColor={SCENE_PALETTE.rimSoft} stopOpacity={0} />
      </radialGradient>
      <linearGradient id="sceneHardwood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={SCENE_PALETTE.hardwoodLight} />
        <stop offset="35%" stopColor={SCENE_PALETTE.hardwoodMid} />
        <stop offset="100%" stopColor={SCENE_PALETTE.hardwoodDark} />
      </linearGradient>
    </defs>
  )
}

/**
 * Props for {@link HandLabel}.
 */
type HandLabelProps = {
  /** Anchor x position in viewBox units. */
  x: number
  /** Baseline y position in viewBox units. */
  y: number
  /** Label text. Keep short — these read like coach's chalk marks. */
  children: ReactNode
  /** Font size in viewBox units. Defaults to 22. */
  size?: number
  /** Horizontal anchor. Defaults to 'middle'. */
  anchor?: 'start' | 'middle' | 'end'
  /** Stroke/fill color. Defaults to the cream palette token. */
  color?: string
}

/**
 * Hand-drawn caption rendered with the Patrick Hand fallback stack. Used to
 * label equipment so a viewer can identify each piece without having to wire
 * interactivity yet.
 *
 * @param props.x - Anchor x position in viewBox units.
 * @param props.y - Baseline y position in viewBox units.
 * @param props.children - Label text.
 * @param props.size - Font size in viewBox units. Defaults to 22.
 * @param props.anchor - Horizontal anchor for the text. Defaults to 'middle'.
 * @param props.color - Text fill color. Defaults to the cream palette token.
 */
export function HandLabel({
  x,
  y,
  children,
  size = 22,
  anchor = 'middle',
  color = SCENE_PALETTE.cream,
}: HandLabelProps) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontFamily={HANDWRITING_FONT}
      fontSize={size}
      textAnchor={anchor}
      style={{ letterSpacing: '0.04em' }}
    >
      {children}
    </text>
  )
}

/**
 * Props for {@link HandFrame}.
 */
type HandFrameProps = {
  /** Top-left x of the frame. */
  x: number
  /** Top-left y of the frame. */
  y: number
  /** Frame width. */
  width: number
  /** Frame height. */
  height: number
  /** Inner fill color. Defaults to the whiteboard tint. */
  fill?: string
  /** Outline color. Defaults to ink. */
  stroke?: string
  /** Stroke width in viewBox units. Defaults to 3. */
  strokeWidth?: number
  /** Corner radius. Defaults to 6. */
  rx?: number
  /** Optional child content rendered on top of the frame. */
  children?: ReactNode
}

/**
 * Hand-drawn rectangular frame used for whiteboards, scoreboards, screens,
 * tablet faces, and signage. Doubles up the stroke to fake a marker outline
 * without needing roughjs at runtime.
 *
 * @param props.x - Top-left x of the frame.
 * @param props.y - Top-left y of the frame.
 * @param props.width - Frame width.
 * @param props.height - Frame height.
 * @param props.fill - Inner fill color. Defaults to the whiteboard tint.
 * @param props.stroke - Outline color. Defaults to ink.
 * @param props.strokeWidth - Outline stroke width. Defaults to 3.
 * @param props.rx - Corner radius. Defaults to 6.
 * @param props.children - Optional content rendered on top of the frame.
 */
export function HandFrame({
  x,
  y,
  width,
  height,
  fill = SCENE_PALETTE.whiteboard,
  stroke = SCENE_PALETTE.inkSoft,
  strokeWidth = 3,
  rx = 6,
  children,
}: HandFrameProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        ry={rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Inner ghost stroke gives a marker-on-board feel. */}
      <rect
        x={x + 4}
        y={y + 4}
        width={width - 8}
        height={height - 8}
        rx={Math.max(0, rx - 2)}
        ry={Math.max(0, rx - 2)}
        fill="none"
        stroke={stroke}
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      {children}
    </g>
  )
}
