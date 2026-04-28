import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughCircle,
  RoughEllipse,
  RoughLineShape,
  RoughRect,
} from './rough-shapes'

const BASE_X = 1320
const BASE_Y = 820
const POLE_HEIGHT = 480
const POLE_X = BASE_X + 40

/**
 * Vertec-style vertical-jump station — the right-side hero of the Combine.
 * Heavy weighted base, tall steel pole, fan-shaped vane cluster at the top
 * with a few vanes pre-swatted to suggest a recent jump.
 *
 * Phase 1 build: decorative only.
 */
export function Vertec() {
  return (
    <g aria-hidden="true">
      {/* Cast shadow under base */}
      <RoughEllipse
        cx={BASE_X + 60}
        cy={BASE_Y + 4}
        width={180}
        height={18}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={0.4}
        roughness={1.5}
        seed={300}
      />

      {/* Lower weighted base */}
      <RoughRect
        x={BASE_X}
        y={BASE_Y - 20}
        width={120}
        height={20}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={1.1}
        seed={301}
      />
      {/* Stack of weight plates on the base — gives it heft */}
      <RoughRect
        x={BASE_X + 6}
        y={BASE_Y - 30}
        width={108}
        height={14}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.8}
        roughness={1.0}
        seed={302}
      />
      <RoughRect
        x={BASE_X + 14}
        y={BASE_Y - 42}
        width={92}
        height={14}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={1.0}
        seed={303}
      />
      <RoughRect
        x={BASE_X + 22}
        y={BASE_Y - 54}
        width={76}
        height={12}
        fill={SCENE_PALETTE.hardwoodDark}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={1.0}
        seed={304}
      />

      {/* Pole */}
      <RoughRect
        x={POLE_X}
        y={BASE_Y - 54 - POLE_HEIGHT}
        width={14}
        height={POLE_HEIGHT}
        fill={SCENE_PALETTE.cream}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.8}
        roughness={0.9}
        seed={305}
      />
      {/* Pole reflection band */}
      <RoughRect
        x={POLE_X + 2}
        y={BASE_Y - 54 - POLE_HEIGHT}
        width={3}
        height={POLE_HEIGHT}
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={0.5}
        seed={306}
      />

      {/* Vane cluster — 16 vanes, top 4 swatted up */}
      {Array.from({ length: 16 }).map((_, i) => {
        const yPos = BASE_Y - 54 - POLE_HEIGHT + 30 + i * 14
        const swung = i < 4
        const length = 80 + i * 1.8
        const color = i % 2 === 0 ? SCENE_PALETTE.rim : SCENE_PALETTE.banner
        return (
          <g key={`vane-${i}`}>
            <RoughLineShape
              x1={POLE_X + 14}
              y1={yPos}
              x2={POLE_X + 14 + length}
              y2={swung ? yPos - 5 : yPos}
              stroke={color}
              strokeWidth={5}
              roughness={0.8}
              seed={310 + i}
            />
            {/* Vane tip dot */}
            <RoughCircle
              cx={POLE_X + 14 + length}
              cy={swung ? yPos - 5 : yPos}
              r={2.5}
              fill={color}
              fillStyle="solid"
              stroke={SCENE_PALETTE.ink}
              strokeWidth={0.8}
              roughness={0.5}
              seed={330 + i}
            />
          </g>
        )
      })}

      {/* Reach scale tick marks on the pole */}
      {[0, 5, 10, 15, 20, 25, 30].map((tickValue, i) => {
        const yPos = BASE_Y - 54 - i * 35
        return (
          <g key={`pole-tick-${tickValue}`}>
            <RoughLineShape
              x1={POLE_X - 8}
              y1={yPos}
              x2={POLE_X}
              y2={yPos}
              stroke={SCENE_PALETTE.ink}
              strokeWidth={1.5}
              roughness={0.5}
              seed={350 + i}
            />
            <text
              x={POLE_X - 12}
              y={yPos + 4}
              textAnchor="end"
              fill={SCENE_PALETTE.cream}
              fontFamily={HANDWRITING_FONT}
              fontSize={11}
            >
              {tickValue}
            </text>
          </g>
        )
      })}

      {/* Reach badge — current best */}
      <g transform={`translate(${POLE_X + 100}, ${BASE_Y - 54 - POLE_HEIGHT + 24})`}>
        <RoughRect
          x={0}
          y={-22}
          width={130}
          height={36}
          fill={SCENE_PALETTE.banner}
          fillStyle="solid"
          stroke={SCENE_PALETTE.ink}
          strokeWidth={2}
          roughness={0.9}
          seed={360}
        />
        <text
          x={65}
          y={3}
          textAnchor="middle"
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={16}
          fontWeight={700}
        >
          reach: 22&quot;
        </text>
      </g>

      {/* Caption */}
      <text
        x={BASE_X + 60}
        y={BASE_Y + 28}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        vertec
      </text>
    </g>
  )
}
