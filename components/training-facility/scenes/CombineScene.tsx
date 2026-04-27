import {
  HardwoodFloor,
  SCENE_PALETTE,
  SceneDefs,
  WallBand,
} from './scene-primitives'
import { Basketball, ChalkPuff, Sneakers, WaterBottle } from './assets/character-props'
import {
  CombineHeaderSign,
  CourtMarkings,
  ResultsBoard,
  TapeMeasure,
} from './assets/combine-fixtures'
import { ShuttleCones } from './assets/ShuttleCones'
import { Stopwatch } from './assets/Stopwatch'
import { Vertec } from './assets/Vertec'

const VIEWBOX_WIDTH = 1600
const VIEWBOX_HEIGHT = 900
const FLOOR_TOP = 600

/**
 * Side-on illustration of The Combine — the movement-benchmark sub-area of
 * the Training Facility. Mirrors PRD §7.5: a staging area, less
 * equipment-dense than the Gym, with cones lined up for the 5-10-5 shuttle,
 * a prominent stopwatch on the floor, a Vertec-style vertical-jump rig on
 * the right, the "WELCOME TO THE COMBINE" banner overhead, a results board
 * pinned to the wall, and a tape measure laid across the floor. Inhabited
 * touches — a pair of sneakers parked by the cones, a Gatorade tucked by
 * the stopwatch, a basketball stashed against the Vertec base, and a chalk
 * puff at the jump station — make the staging area feel used, not staged.
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
      aria-label="The Combine — staging area with shuttle cones, a stopwatch, a Vertec vertical-jump station, sneakers and a basketball on the floor, and a results board on the wall."
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

      {/* Wall fixtures */}
      <ResultsBoard />
      <CombineHeaderSign />

      {/* Floor equipment + character props */}
      <ShuttleCones />
      {/* Sneakers parked beside the rear cone */}
      <Sneakers x={130} y={832} seed={950} />

      <Stopwatch />
      {/* Gatorade by the stopwatch */}
      <WaterBottle
        x={1100}
        y={760}
        bodyFill={SCENE_PALETTE.banner}
        capFill={SCENE_PALETTE.rim}
        labelFill={SCENE_PALETTE.rim}
        mark="G"
        seed={970}
      />

      <Vertec />
      {/* Chalk residue at the foot of the Vertec */}
      <ChalkPuff x={1280} y={826} seed={985} />
      {/* Stashed basketball near the Vertec base */}
      <Basketball cx={1265} cy={808} r={16} seed={990} />

      <TapeMeasure />
    </svg>
  )
}
