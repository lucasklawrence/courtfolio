import Link from 'next/link'

import {
  HardwoodFloor,
  SCENE_PALETTE,
  SceneDefs,
  WallBand,
} from './scene-primitives'
import { Basketball, SweatTowel, WaterBottle } from './assets/character-props'
import {
  BenchWithTablet,
  DoorToCombine,
  HrMonitor,
  IndoorTrackSilhouette,
  Vo2MaxWhiteboard,
  WallScoreboard,
} from './assets/gym-fixtures'
import { StairClimber } from './assets/StairClimber'
import { Treadmill } from './assets/Treadmill'

const VIEWBOX_WIDTH = 1600
const VIEWBOX_HEIGHT = 900
const FLOOR_TOP = 600

/**
 * Side-on illustration of The Gym — the cardio sub-area of the Training
 * Facility. Mirrors PRD §7.4: stair climber centered, treadmill on the left,
 * indoor track silhouette curving along the back wall, HR monitor + VO2max
 * whiteboard + wall scoreboard along the wall, bench with a clipboard, and
 * a back door that leads to The Combine. Inhabited touches — sweat towel
 * draped over the treadmill rail, a water bottle by the bench, a basketball
 * tucked beside the stair climber — give the room warmth without crowding.
 *
 * Phase 1 build — equipment is decorative only. The door at the back is the
 * single interactive element so the two sub-area scenes connect spatially.
 */
export function GymScene() {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      role="img"
      aria-label="The Gym — side-on view of stair climber, treadmill, indoor track, wall fixtures, bench, and a door leading to the Combine."
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

      <IndoorTrackSilhouette />

      <HardwoodFloor
        y={FLOOR_TOP}
        height={VIEWBOX_HEIGHT - FLOOR_TOP}
        width={VIEWBOX_WIDTH}
      />

      {/* Wall fixtures (back-most) */}
      <HrMonitor />
      <Vo2MaxWhiteboard />
      <WallScoreboard />

      {/* Foreground equipment */}
      <Treadmill />
      <SweatTowel />

      {/*
        Stair-climber group is wrapped in a Next.js `<Link>` to its detail
        view (PRD §7.4). Same pattern as `DoorToCombine` — group-scoped
        hover/focus overlays sit on top of the asset and only become visible
        when the parent anchor is hovered or keyboard-focused, so the static
        scene stays clean.
      */}
      <Link
        href="/training-facility/gym/stair"
        aria-label="Open the stair climber detail view"
        className="group focus:outline-none"
      >
        <StairClimber />
        {/* Hover/focus tint over the stair-climber footprint */}
        <rect
          x={500}
          y={395}
          width={460}
          height={485}
          fill={SCENE_PALETTE.creamBright}
          className="opacity-0 transition-opacity group-hover:opacity-10 group-focus-visible:opacity-15"
        />
        {/* Focus ring — visible only when keyboard-focused */}
        <rect
          x={500}
          y={395}
          width={460}
          height={485}
          fill="none"
          stroke={SCENE_PALETTE.rim}
          strokeWidth={4}
          strokeDasharray="6 4"
          rx={6}
          className="opacity-0 transition-opacity group-focus-visible:opacity-100"
        />
      </Link>
      {/* Basketball tucked next to the stair climber */}
      <Basketball cx={910} cy={812} r={18} seed={900} />

      <BenchWithTablet />
      {/* Water bottle on the floor at the bench's right foot */}
      <WaterBottle
        x={1180}
        y={758}
        bodyFill={SCENE_PALETTE.rim}
        capFill={SCENE_PALETTE.ink}
        labelFill={SCENE_PALETTE.creamBright}
        mark="H₂O"
        seed={920}
      />

      <DoorToCombine />
    </svg>
  )
}
