import {
  HANDWRITING_FONT,
  HardwoodFloor,
  SCENE_PALETTE,
  SceneDefs,
  WallBand,
} from './scene-primitives'
import { BenchPressSvg } from './assets/equipment/BenchPressSvg'
import { DumbellRackSvg } from './assets/equipment/DumbellRackSvg'
import { PlyoBoxSvg } from './assets/equipment/PlyoBoxSvg'
import { SquatRackSvg } from './assets/equipment/SquatRackSvg'
import { YogaMatSvg } from './assets/equipment/YogaMatSvg'

const VIEWBOX_WIDTH = 1600
const VIEWBOX_HEIGHT = 900
const FLOOR_TOP = 600

/**
 * Side-on illustration of The Weight Room — the strength sub-area of the
 * Training Facility. Composes the five illustrated strength pieces left to
 * right: dumbbell rack along the wall, the squat-rack centerpiece, a flat
 * bench mid-floor, a plyo box, and a yoga mat parked by the right edge.
 *
 * Same shell as the Gym and Combine scenes — `WallBand` + `HardwoodFloor`
 * over a 1600×900 viewBox — so all three sub-rooms read as the same
 * facility. No wall fixtures wired yet; this is the decorative baseline.
 */
export function WeightRoomScene() {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      role="img"
      aria-label="The Weight Room — side-on view of a dumbbell rack along the wall, a squat rack centerpiece, a flat bench, a plyo box, and a yoga mat on the floor."
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

      {/* Equipment laid out along the floor, left → right. Each illustration
          is anchored bottom-center within its bounding box so its feet sit
          on the floor regardless of the source SVG's internal padding. */}
      <DumbellRackSvg
        x={60}
        y={380}
        width={240}
        height={480}
        preserveAspectRatio="xMidYMax meet"
      />

      <SquatRackSvg
        x={320}
        y={260}
        width={320}
        height={600}
        preserveAspectRatio="xMidYMax meet"
      />

      <BenchPressSvg
        x={660}
        y={460}
        width={400}
        height={400}
        preserveAspectRatio="xMidYMax meet"
      />

      <PlyoBoxSvg
        x={1080}
        y={540}
        width={250}
        height={320}
        preserveAspectRatio="xMidYMax meet"
      />

      <YogaMatSvg
        x={1340}
        y={700}
        width={240}
        height={160}
        preserveAspectRatio="xMidYMax meet"
      />

      {/* Caption — same handwritten flavor as the Gym caption strip */}
      <text
        x={VIEWBOX_WIDTH / 2}
        y={870}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        the weight room
      </text>
    </svg>
  )
}
