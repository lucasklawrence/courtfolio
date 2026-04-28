import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughCircle,
  RoughLineShape,
  RoughPath,
  RoughRect,
} from './rough-shapes'

/**
 * Court-line cream markings on the floor — a baseline strip across the back
 * and a partial free-throw arc curving forward at the right. Suggests the
 * Combine is staged on a half-court.
 */
export function CourtMarkings() {
  return (
    <g aria-hidden="true">
      {/* Baseline strip */}
      <RoughLineShape
        x1={40}
        y1={620}
        x2={1560}
        y2={620}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={3}
        roughness={1.0}
        seed={600}
      />
      {/* Free-throw arc fragment */}
      <RoughPath
        d="M 1100 620 Q 1260 720 1100 820"
        fill="none"
        stroke={SCENE_PALETTE.cream}
        strokeWidth={3}
        roughness={1.4}
        bowing={1.2}
        seed={601}
      />
      {/* Cross-court tick marks */}
      {[200, 460, 720, 980].map((x, i) => (
        <RoughLineShape
          key={`court-tick-${x}`}
          x1={x}
          y1={616}
          x2={x}
          y2={628}
          stroke={SCENE_PALETTE.cream}
          strokeWidth={2}
          roughness={0.7}
          seed={602 + i}
        />
      ))}
    </g>
  )
}

/**
 * "Welcome to The Combine" banner suspended on the back wall by two cords.
 * The Combine equivalent of the Gym scoreboard, but in banner-yellow.
 */
export function CombineHeaderSign() {
  return (
    <g>
      {/* Suspension cords */}
      <RoughLineShape
        x1={560}
        y1={40}
        x2={560}
        y2={90}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={1.5}
        roughness={1.0}
        seed={620}
      />
      <RoughLineShape
        x1={1040}
        y1={40}
        x2={1040}
        y2={90}
        stroke={SCENE_PALETTE.cream}
        strokeWidth={1.5}
        roughness={1.0}
        seed={621}
      />

      {/* Banner */}
      <RoughRect
        x={520}
        y={90}
        width={560}
        height={120}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={3}
        roughness={1.0}
        seed={622}
      />
      {/* Inner trim */}
      <RoughRect
        x={534}
        y={102}
        width={532}
        height={96}
        fill="none"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.2}
        roughness={0.8}
        seed={623}
      />
      {/* Pin nails */}
      <RoughCircle cx={534} cy={104} r={3} fill={SCENE_PALETTE.ink} fillStyle="solid" stroke="none" strokeWidth={0} roughness={0.5} seed={624} />
      <RoughCircle cx={1066} cy={104} r={3} fill={SCENE_PALETTE.ink} fillStyle="solid" stroke="none" strokeWidth={0} roughness={0.5} seed={625} />
      <RoughCircle cx={534} cy={194} r={3} fill={SCENE_PALETTE.ink} fillStyle="solid" stroke="none" strokeWidth={0} roughness={0.5} seed={626} />
      <RoughCircle cx={1066} cy={194} r={3} fill={SCENE_PALETTE.ink} fillStyle="solid" stroke="none" strokeWidth={0} roughness={0.5} seed={627} />

      <text
        x={800}
        y={150}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={26}
      >
        welcome to
      </text>
      <text
        x={800}
        y={190}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={50}
        fontWeight={700}
      >
        THE COMBINE
      </text>
    </g>
  )
}

/**
 * Wall-mounted results board — clipboard pinned to the wall showing the
 * latest benchmark numbers as hand-printed stat lines.
 */
export function ResultsBoard() {
  const lines: Array<{ label: string; value: string; unit: string }> = [
    { label: '5-10-5 shuttle', value: '5.42', unit: 's' },
    { label: 'vertical', value: '22.0', unit: 'in' },
    { label: '10y sprint', value: '1.91', unit: 's' },
  ]

  return (
    <g>
      {/* Board */}
      <RoughRect
        x={120}
        y={110}
        width={340}
        height={250}
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={3}
        roughness={1.0}
        seed={650}
      />
      {/* Inner ghost frame */}
      <RoughRect
        x={132}
        y={122}
        width={316}
        height={226}
        fill="none"
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={1}
        roughness={0.8}
        seed={651}
      />
      {/* Binder clip */}
      <RoughRect
        x={270}
        y={100}
        width={40}
        height={18}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.8}
        seed={652}
      />
      <RoughRect
        x={278}
        y={92}
        width={24}
        height={10}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.2}
        roughness={0.7}
        seed={653}
      />

      <text
        x={290}
        y={155}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
        fontWeight={700}
      >
        latest measurables
      </text>
      <RoughLineShape
        x1={140}
        y1={170}
        x2={440}
        y2={170}
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={1.5}
        roughness={0.8}
        seed={654}
      />

      {lines.map((line, i) => {
        const y = 200 + i * 44
        return (
          <g key={line.label}>
            <text
              x={140}
              y={y}
              fill={SCENE_PALETTE.inkSoft}
              fontFamily={HANDWRITING_FONT}
              fontSize={20}
            >
              {line.label}
            </text>
            <text
              x={440}
              y={y}
              textAnchor="end"
              fill={SCENE_PALETTE.rim}
              fontFamily={HANDWRITING_FONT}
              fontSize={26}
              fontWeight={700}
            >
              {line.value}
              <tspan
                fontSize={16}
                fill={SCENE_PALETTE.inkSoft}
                fillOpacity={0.7}
              >
                {' '}
                {line.unit}
              </tspan>
            </text>
            <RoughLineShape
              x1={140}
              y1={y + 8}
              x2={440}
              y2={y + 8}
              stroke={SCENE_PALETTE.inkSoft}
              strokeWidth={0.8}
              roughness={0.7}
              seed={655 + i}
            />
          </g>
        )
      })}
      <text
        x={290}
        y={388}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={18}
      >
        results board
      </text>
    </g>
  )
}

/**
 * Strip of yellow tape measure pulled across the floor in front of the
 * cones, marked in feet. Reinforces the "measurables" theme without crowding
 * the floor.
 */
export function TapeMeasure() {
  const startX = 200
  const endX = 880
  const y = 760
  const ticks = [0, 5, 10, 15, 20]
  return (
    <g>
      {/* Tape body */}
      <RoughLineShape
        x1={startX}
        y1={y}
        x2={endX}
        y2={y}
        stroke={SCENE_PALETTE.banner}
        strokeWidth={6}
        roughness={0.7}
        seed={700}
      />
      {/* Edge line */}
      <RoughLineShape
        x1={startX}
        y1={y + 4}
        x2={endX}
        y2={y + 4}
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.6}
        seed={701}
      />
      {/* End hook (start) */}
      <RoughRect
        x={startX - 14}
        y={y - 8}
        width={14}
        height={20}
        fill={SCENE_PALETTE.cream}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.9}
        seed={702}
      />
      {ticks.map((tick, i) => {
        const x = startX + (i / (ticks.length - 1)) * (endX - startX)
        return (
          <g key={`tape-${tick}`}>
            <RoughLineShape
              x1={x}
              y1={y - 8}
              x2={x}
              y2={y + 8}
              stroke={SCENE_PALETTE.ink}
              strokeWidth={2}
              roughness={0.5}
              seed={703 + i}
            />
            <text
              x={x}
              y={y - 14}
              textAnchor="middle"
              fill={SCENE_PALETTE.cream}
              fontFamily={HANDWRITING_FONT}
              fontSize={16}
              fontWeight={700}
            >
              {tick}ft
            </text>
          </g>
        )
      })}
    </g>
  )
}
