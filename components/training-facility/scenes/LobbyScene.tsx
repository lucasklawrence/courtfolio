import { SceneDefs, SCENE_PALETTE } from './scene-primitives'
import { Basketball, WaterBottle } from './assets/character-props'
import { CorridorDoor, type DoorCorners, type Point } from './assets/CorridorDoor'

const VIEWBOX_WIDTH = 1600
const VIEWBOX_HEIGHT = 900

/** One-point-perspective vanishing point, a touch above center so the floor reads bigger than the ceiling. */
const VP: Point = { x: 800, y: 380 }

/** The far wall rectangle where all orthogonals converge — the end of the hall. */
const BACK = { left: 620, right: 980, top: 230, bottom: 540 } as const

/**
 * Y of the orthogonal through `anchor` and the vanishing point, at a
 * given screen `x`. Used to seat each side-wall door flush against the
 * corridor's converging head and floor lines.
 */
function orthoYAtX(anchor: Point, x: number): number {
  return anchor.y + ((VP.y - anchor.y) * (x - anchor.x)) / (VP.x - anchor.x)
}

/**
 * Project a near-floor point toward the vanishing point until it reaches
 * `atY`. Used to draw the receding floor-plank seams.
 */
function towardVpAtY(near: Point, atY: number): Point {
  const t = (near.y - atY) / (near.y - VP.y)
  return { x: near.x + t * (VP.x - near.x), y: atY }
}

/**
 * Build the four corners of a side-wall door from its near/far screen-x
 * cuts. Tops ride the door-head orthogonal (anchored at screen-edge
 * `headY`), bottoms ride the floor orthogonal (anchored on the floor at
 * the screen edge), so the panel foreshortens correctly into the wall.
 *
 * @param edgeX - Screen x of the wall's near vertical edge (0 = left wall, 1600 = right wall).
 * @param headY - Door-head height at that near edge, in viewBox units.
 * @param nearX - Screen x of the door's outer (nearer) stile.
 * @param farX - Screen x of the door's inner (deeper) stile.
 */
function sideDoorCorners(edgeX: number, headY: number, nearX: number, farX: number): DoorCorners {
  const head: Point = { x: edgeX, y: headY }
  const floor: Point = { x: edgeX, y: 900 }
  return [
    { x: nearX, y: orthoYAtX(head, nearX) },
    { x: farX, y: orthoYAtX(head, farX) },
    { x: farX, y: orthoYAtX(floor, farX) },
    { x: nearX, y: orthoYAtX(floor, nearX) },
  ]
}

// Left wall (The Combine): door cut between screen x 150 (near) and 330 (far).
const LEFT_DOOR = sideDoorCorners(0, 300, 150, 330)
// Right wall (Weight Room): mirror of the left door across x = 800.
const RIGHT_DOOR = sideDoorCorners(VIEWBOX_WIDTH, 300, 1450, 1270)

// End of the hall (The Gym): a front-facing door standing on the back-wall floor.
const END_DOOR_WIDTH = 150
const END_DOOR_TOP = 300
const END_DOOR: DoorCorners = [
  { x: VP.x - END_DOOR_WIDTH / 2, y: END_DOOR_TOP },
  { x: VP.x + END_DOOR_WIDTH / 2, y: END_DOOR_TOP },
  { x: VP.x + END_DOOR_WIDTH / 2, y: BACK.bottom },
  { x: VP.x - END_DOOR_WIDTH / 2, y: BACK.bottom },
]

/** Midpoint of a door's top edge — anchor for its overhead sign board. */
function topEdgeMidpoint(corners: DoorCorners): Point {
  return { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }
}

/** Serialize points into an SVG polygon `points` attribute. */
function polyPoints(points: readonly Point[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

// Corridor surfaces (tunnel walls) as polygons from the viewport edges to
// the back-wall rectangle corners.
const CEILING = polyPoints([
  { x: 0, y: 0 },
  { x: VIEWBOX_WIDTH, y: 0 },
  { x: BACK.right, y: BACK.top },
  { x: BACK.left, y: BACK.top },
])
const LEFT_WALL = polyPoints([
  { x: 0, y: 0 },
  { x: BACK.left, y: BACK.top },
  { x: BACK.left, y: BACK.bottom },
  { x: 0, y: VIEWBOX_HEIGHT },
])
const RIGHT_WALL = polyPoints([
  { x: VIEWBOX_WIDTH, y: 0 },
  { x: BACK.right, y: BACK.top },
  { x: BACK.right, y: BACK.bottom },
  { x: VIEWBOX_WIDTH, y: VIEWBOX_HEIGHT },
])
const FLOOR = polyPoints([
  { x: 0, y: VIEWBOX_HEIGHT },
  { x: VIEWBOX_WIDTH, y: VIEWBOX_HEIGHT },
  { x: BACK.right, y: BACK.bottom },
  { x: BACK.left, y: BACK.bottom },
])

// Receding floor-plank seams — only those that land on the back-wall
// floor edge (between BACK.left and BACK.right) are drawn, so seams don't
// spill onto the side walls.
const FLOOR_SEAMS = [100, 300, 500, 700, 900, 1100, 1300, 1500]
  .map(nearX => ({ near: { x: nearX, y: VIEWBOX_HEIGHT }, far: towardVpAtY({ x: nearX, y: VIEWBOX_HEIGHT }, BACK.bottom) }))
  .filter(seam => seam.far.x >= BACK.left && seam.far.x <= BACK.right)

// The four perspective corner lines that sharpen the tunnel edges.
const CORNER_LINES: Array<[Point, Point]> = [
  [{ x: 0, y: 0 }, { x: BACK.left, y: BACK.top }],
  [{ x: VIEWBOX_WIDTH, y: 0 }, { x: BACK.right, y: BACK.top }],
  [{ x: 0, y: VIEWBOX_HEIGHT }, { x: BACK.left, y: BACK.bottom }],
  [{ x: VIEWBOX_WIDTH, y: VIEWBOX_HEIGHT }, { x: BACK.right, y: BACK.bottom }],
]

/**
 * Side-on, one-point-perspective corridor for the Training Facility
 * lobby — the top-level `/training-facility` scene. You stand at the
 * mouth of a hallway; the three sub-areas are doors down the hall: The
 * Combine set into the left wall, Weight Room into the right, and The
 * Gym straight ahead at the end of the corridor. Each door is a real
 * Next.js link with the same hover-tint + keyboard-focus-ring affordances
 * used across the other Training Facility scenes.
 *
 * Built in the shared scene idiom (`SceneDefs`, `SCENE_PALETTE`,
 * character props) so it reads as continuous with the rooms behind each
 * door. Navigational only — the doors carry no live data in this pass.
 */
export function LobbyScene() {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      // Deliberately NOT role="img": this is the only path into the three
      // sub-areas, and `img` is a presentational-children role that would
      // drop the door <Link>s from the accessibility tree. Leaving the svg
      // as a labelled graphics-document keeps each doorway a real link for
      // screen-reader / keyboard users.
      aria-label="The Training Facility lobby — a corridor with a door into The Combine on the left, Weight Room on the right, and The Gym straight ahead at the end of the hall."
    >
      <SceneDefs />
      <defs>
        <linearGradient id="lobbyLeftWall" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={BACK.left} y2={0}>
          <stop offset="0%" stopColor={SCENE_PALETTE.wallHighlight} />
          <stop offset="100%" stopColor={SCENE_PALETTE.ink} />
        </linearGradient>
        <linearGradient
          id="lobbyRightWall"
          gradientUnits="userSpaceOnUse"
          x1={VIEWBOX_WIDTH}
          y1={0}
          x2={BACK.right}
          y2={0}
        >
          <stop offset="0%" stopColor={SCENE_PALETTE.wallHighlight} />
          <stop offset="100%" stopColor={SCENE_PALETTE.ink} />
        </linearGradient>
        <linearGradient id="lobbyCeiling" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={BACK.top}>
          <stop offset="0%" stopColor={SCENE_PALETTE.ink} />
          <stop offset="100%" stopColor={SCENE_PALETTE.wallWarm} />
        </linearGradient>
        <radialGradient
          id="lobbyGlow"
          gradientUnits="userSpaceOnUse"
          cx={VP.x}
          cy={VP.y}
          r={280}
        >
          <stop offset="0%" stopColor={SCENE_PALETTE.rimSoft} stopOpacity={0.35} />
          <stop offset="70%" stopColor={SCENE_PALETTE.rimSoft} stopOpacity={0.06} />
          <stop offset="100%" stopColor={SCENE_PALETTE.rimSoft} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Tunnel surfaces */}
      <polygon points={CEILING} fill="url(#lobbyCeiling)" />
      <polygon points={LEFT_WALL} fill="url(#lobbyLeftWall)" />
      <polygon points={RIGHT_WALL} fill="url(#lobbyRightWall)" />
      <polygon points={FLOOR} fill="url(#sceneHardwood)" />

      {/* Receding floor-plank seams */}
      {FLOOR_SEAMS.map(seam => (
        <line
          key={`seam-${seam.near.x}`}
          x1={seam.near.x}
          y1={seam.near.y}
          x2={seam.far.x}
          y2={seam.far.y}
          stroke={SCENE_PALETTE.hardwoodDark}
          strokeOpacity={0.5}
          strokeWidth={1.4}
        />
      ))}

      {/* Back wall + warm end-of-hall glow */}
      <rect x={BACK.left} y={BACK.top} width={BACK.right - BACK.left} height={BACK.bottom - BACK.top} fill={SCENE_PALETTE.wallWarm} />
      <rect x={BACK.left} y={BACK.top} width={BACK.right - BACK.left} height={BACK.bottom - BACK.top} fill="url(#lobbyGlow)" />

      {/* Crisp perspective corner lines */}
      {CORNER_LINES.map(([a, b], i) => (
        <line
          key={`corner-${i}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={SCENE_PALETTE.ink}
          strokeOpacity={0.4}
          strokeWidth={1.4}
        />
      ))}

      {/* Doors down the hall */}
      <CorridorDoor
        href="/training-facility/combine"
        ariaLabel="Enter The Combine"
        title="The Combine"
        subtitle="movement wing"
        corners={LEFT_DOOR}
        label={{ ...topEdgeMidpoint(LEFT_DOOR), y: 250 }}
      />
      <CorridorDoor
        href="/training-facility/weight-room"
        ariaLabel="Enter the Weight Room"
        title="Weight Room"
        subtitle="strength wing"
        corners={RIGHT_DOOR}
        label={{ ...topEdgeMidpoint(RIGHT_DOOR), y: 250 }}
      />
      <CorridorDoor
        href="/training-facility/gym"
        ariaLabel="Enter The Gym"
        title="The Gym"
        corners={END_DOOR}
        label={{ x: VP.x, y: 266 }}
      />

      {/* Inhabited foreground touches */}
      <Basketball cx={300} cy={842} r={26} seed={300} />
      <WaterBottle
        x={1250}
        y={798}
        bodyFill={SCENE_PALETTE.rim}
        capFill={SCENE_PALETTE.ink}
        labelFill={SCENE_PALETTE.creamBright}
        mark="H₂O"
        seed={320}
      />
    </svg>
  )
}
