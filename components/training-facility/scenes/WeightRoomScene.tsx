import type { WeightRoomData } from '@/types/weight-room'

import {
  HANDWRITING_FONT,
  HardwoodFloor,
  SCENE_PALETTE,
  SceneDefs,
  WallBand,
} from './scene-primitives'
import { BenchPressSvg } from './assets/equipment/BenchPressSvg'
import { DumbbellRackSvg } from './assets/equipment/DumbbellRackSvg'
import { PlyoBoxSvg } from './assets/equipment/PlyoBoxSvg'
import { SquatRackSvg } from './assets/equipment/SquatRackSvg'
import { YogaMatSvg } from './assets/equipment/YogaMatSvg'
import { WallActivityRings } from './assets/weight-room-fixtures'

const VIEWBOX_WIDTH = 1600
const VIEWBOX_HEIGHT = 900
const FLOOR_TOP = 600

/** Props for {@link WeightRoomScene}. */
export interface WeightRoomSceneProps {
  /**
   * Today's strength dataset. Hydrates the wall fixture (activity rings
   * + per-exercise tallies + streaks). Pass `null` to render the fixture
   * with ghost rings / zero tallies — the empty state of
   * `getWeightRoomDataServer()` returning `null` before any sets have
   * been logged.
   */
  data?: WeightRoomData | null
}

/**
 * Side-on illustration of The Weight Room — the strength sub-area of the
 * Training Facility. Composes the five illustrated strength pieces left to
 * right (dumbbell rack, squat-rack centerpiece, flat bench, plyo box, yoga
 * mat) and a "today" wall fixture above the squat rack showing the activity
 * rings + per-exercise tallies + streak counts.
 *
 * Same shell as the Gym and Combine scenes — `WallBand` + `HardwoodFloor`
 * over a 1600×900 viewBox — so all three sub-rooms read as the same
 * facility. Read-only: visitors see the room "in use" without any
 * data-entry UI (admin owners log sets via `/training-facility/weight-room/log`).
 */
export function WeightRoomScene({
  data = null,
}: WeightRoomSceneProps = {}) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      role="img"
      aria-label="The Weight Room — side-on view of a dumbbell rack along the wall, a squat rack centerpiece, a flat bench, a plyo box, and a yoga mat on the floor, with today's activity rings mounted on the wall above the squat rack."
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

      {/* Wall fixture — today's activity rings, mounted above the squat rack. */}
      <WallActivityRings data={data} />

      {/* Equipment laid out along the floor, left → right. Each illustration
          is anchored bottom-center within its bounding box so its feet sit
          on the floor regardless of the source SVG's internal padding. */}
      <DumbbellRackSvg
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
