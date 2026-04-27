import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughEllipse,
  RoughLineShape,
  RoughPath,
  RoughPolygon,
  RoughRect,
} from './rough-shapes'

type ConeSpec = {
  cx: number
  baseY: number
  height: number
  /** Determinism seed offset — keep stable so rough strokes don't flicker. */
  seed: number
}

const CONES: ConeSpec[] = [
  { cx: 280, baseY: 820, height: 90, seed: 500 },
  { cx: 540, baseY: 820, height: 110, seed: 510 },
  { cx: 800, baseY: 820, height: 90, seed: 520 },
]

/**
 * Cluster of three pylon cones lined up for a 5-10-5 shuttle drill. The
 * middle cone is taller to anchor the eye, and a dashed run-line connects
 * them along the floor.
 */
export function ShuttleCones() {
  return (
    <g aria-hidden="true">
      {/* Run line */}
      <RoughPath
        d="M 200 845 L 880 845"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={2}
        roughness={1.4}
        seed={490}
        // dashed via stroke-dasharray injected through dasharray prop?
        // RoughPath doesn't support dasharray; render as dashes via separate segments below
      />
      {/* Run-line dashes overlaid in ink to read as dashed */}
      {[260, 360, 460, 580, 680, 780].map((x, i) => (
        <RoughLineShape
          key={`dash-mask-${x}`}
          x1={x}
          y1={845}
          x2={x + 30}
          y2={845}
          stroke="#241811"
          strokeWidth={4}
          roughness={0.5}
          seed={491 + i}
        />
      ))}

      {CONES.map(cone => (
        <ShuttleCone key={`cone-${cone.cx}`} cone={cone} />
      ))}

      <text
        x={540}
        y={870}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        shuttle cones
      </text>
    </g>
  )
}

/**
 * One pylon cone — orange body with a cream reflective stripe and a wooden
 * weighted base. Hand-drawn outline to match the scene's marker aesthetic.
 *
 * @param props.cone - Cone position + height + seed offset.
 */
function ShuttleCone({ cone }: { cone: ConeSpec }) {
  const { cx, baseY, height, seed } = cone
  const halfBase = height * 0.4

  return (
    <g>
      {/* Cast shadow */}
      <RoughEllipse
        cx={cx}
        cy={baseY + 12}
        width={height * 0.95}
        height={10}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={1.5}
        seed={seed}
      />

      {/* Cone body (triangle) */}
      <RoughPolygon
        points={[
          [cx, baseY - height],
          [cx - halfBase, baseY],
          [cx + halfBase, baseY],
        ]}
        fill={SCENE_PALETTE.rim}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.3}
        seed={seed + 1}
      />

      {/* Reflective stripe — narrower trapezoid wrapping the cone */}
      <RoughPolygon
        points={[
          [cx - height * 0.2, baseY - height * 0.5],
          [cx + height * 0.2, baseY - height * 0.5],
          [cx + height * 0.26, baseY - height * 0.34],
          [cx - height * 0.26, baseY - height * 0.34],
        ]}
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.2}
        roughness={1.0}
        seed={seed + 2}
      />

      {/* Top dot — opening of the cone */}
      <RoughEllipse
        cx={cx}
        cy={baseY - height + 3}
        width={6}
        height={3}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={0.8}
        roughness={0.6}
        seed={seed + 3}
      />

      {/* Weighted base — wooden block */}
      <RoughRect
        x={cx - height * 0.55}
        y={baseY - 4}
        width={height * 1.1}
        height={10}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.8}
        roughness={1.0}
        seed={seed + 4}
      />
    </g>
  )
}
