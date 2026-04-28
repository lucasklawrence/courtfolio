import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import {
  RoughCircle,
  RoughLineShape,
  RoughRect,
} from './rough-shapes'

const CX = 1010
const CY = 720
const R = 80

/**
 * Big hand-drawn stopwatch sitting in the center-front of the Combine staging
 * area. Crown + side button on top, double-ringed face, hour ticks, a single
 * red sweep hand pointing at 5.42 seconds and a digital readout below.
 *
 * Phase 1 build: decorative only.
 */
export function Stopwatch() {
  return (
    <g aria-hidden="true">
      {/* Cast shadow */}
      <RoughCircle
        cx={CX}
        cy={CY + R + 4}
        r={R + 6}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={1.5}
        seed={400}
      />
      <RoughCircle
        cx={CX}
        cy={CY + R + 4}
        r={R + 4}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={1.4}
        seed={401}
      />

      {/* Crown stem (top) */}
      <RoughRect
        x={CX - 12}
        y={CY - R - 28}
        width={24}
        height={20}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={402}
      />
      {/* Crown knurled head */}
      <RoughRect
        x={CX - 22}
        y={CY - R - 12}
        width={44}
        height={10}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={403}
      />
      {/* Knurl ridges */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <RoughLineShape
          key={`knurl-${i}`}
          x1={CX - 18 + i * 7}
          y1={CY - R - 11}
          x2={CX - 18 + i * 7}
          y2={CY - R - 4}
          stroke={SCENE_PALETTE.cream}
          strokeWidth={0.8}
          roughness={0.5}
          seed={404 + i}
        />
      ))}
      {/* Side button (right) */}
      <g transform={`rotate(35, ${CX + R - 11}, ${CY - R})`}>
        <RoughRect
          x={CX + R - 18}
          y={CY - R - 6}
          width={14}
          height={12}
          fill={SCENE_PALETTE.inkSoft}
          fillStyle="solid"
          stroke={SCENE_PALETTE.ink}
          strokeWidth={1.5}
          roughness={1.0}
          seed={410}
        />
      </g>

      {/* Outer dark ring */}
      <RoughCircle
        cx={CX}
        cy={CY}
        r={R + 6}
        fill={SCENE_PALETTE.inkSoft}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2}
        roughness={1.0}
        seed={411}
      />
      {/* Face */}
      <RoughCircle
        cx={CX}
        cy={CY}
        r={R}
        fill={SCENE_PALETTE.creamBright}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={2.5}
        roughness={0.9}
        seed={412}
      />
      {/* Inner ring decoration */}
      <RoughCircle
        cx={CX}
        cy={CY}
        r={R - 12}
        fill="none"
        stroke={SCENE_PALETTE.inkSoft}
        strokeWidth={0.8}
        roughness={0.7}
        seed={413}
      />

      {/* Hour ticks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        const inner = i % 3 === 0 ? R - 14 : R - 8
        const x1 = CX + Math.cos(angle) * inner
        const y1 = CY + Math.sin(angle) * inner
        const x2 = CX + Math.cos(angle) * (R - 2)
        const y2 = CY + Math.sin(angle) * (R - 2)
        return (
          <RoughLineShape
            key={`tick-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={SCENE_PALETTE.inkSoft}
            strokeWidth={i % 3 === 0 ? 3 : 1.5}
            roughness={0.6}
            seed={420 + i}
          />
        )
      })}

      {/* Numerals at 12 / 3 / 6 / 9 */}
      {[
        { num: '60', x: CX, y: CY - R + 22, anchor: 'middle' as const },
        { num: '15', x: CX + R - 22, y: CY + 6, anchor: 'middle' as const },
        { num: '30', x: CX, y: CY + R - 14, anchor: 'middle' as const },
        { num: '45', x: CX - R + 22, y: CY + 6, anchor: 'middle' as const },
      ].map(({ num, x, y, anchor }) => (
        <text
          key={`num-${num}`}
          x={x}
          y={y}
          textAnchor={anchor}
          fill={SCENE_PALETTE.inkSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={14}
          fontWeight={700}
        >
          {num}
        </text>
      ))}

      {/* Sweep hand at 5.42 seconds */}
      {(() => {
        const angle = (5.42 / 60) * Math.PI * 2 - Math.PI / 2
        const tipX = CX + Math.cos(angle) * (R - 18)
        const tipY = CY + Math.sin(angle) * (R - 18)
        // Counter-balance tail
        const tailX = CX + Math.cos(angle + Math.PI) * 18
        const tailY = CY + Math.sin(angle + Math.PI) * 18
        return (
          <>
            <RoughLineShape
              x1={tailX}
              y1={tailY}
              x2={tipX}
              y2={tipY}
              stroke={SCENE_PALETTE.rim}
              strokeWidth={4}
              roughness={0.6}
              seed={440}
            />
            <RoughCircle
              cx={tipX}
              cy={tipY}
              r={3}
              fill={SCENE_PALETTE.rim}
              fillStyle="solid"
              stroke={SCENE_PALETTE.ink}
              strokeWidth={0.8}
              roughness={0.6}
              seed={441}
            />
          </>
        )
      })()}
      {/* Center hub */}
      <RoughCircle
        cx={CX}
        cy={CY}
        r={6}
        fill={SCENE_PALETTE.rim}
        fillStyle="solid"
        stroke={SCENE_PALETTE.ink}
        strokeWidth={1.5}
        roughness={0.7}
        seed={442}
      />
      <RoughCircle
        cx={CX}
        cy={CY}
        r={2}
        fill={SCENE_PALETTE.banner}
        fillStyle="solid"
        stroke="none"
        strokeWidth={0}
        roughness={0.4}
        seed={443}
      />

      {/* Digital readout below center */}
      <text
        x={CX}
        y={CY + 38}
        textAnchor="middle"
        fill={SCENE_PALETTE.inkSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={20}
        fontWeight={700}
      >
        5.42&quot;
      </text>

      {/* Caption */}
      <text
        x={CX}
        y={CY + R + 60}
        textAnchor="middle"
        fill={SCENE_PALETTE.cream}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
      >
        stopwatch
      </text>
    </g>
  )
}
