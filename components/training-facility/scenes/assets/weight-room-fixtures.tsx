'use client'

import { useEffect, useState, type JSX } from 'react'

import { computeStrengthStreaks } from '@/lib/training-facility/strength-streaks'
import {
  filterSetsForDay,
  toLocalDateKey,
  totalsByExercise,
} from '@/lib/training-facility/strength-today'
import type { WeightRoomData } from '@/types/weight-room'

import { HANDWRITING_FONT, SCENE_PALETTE } from '../scene-primitives'
import { RoughRect } from './rough-shapes'

/** Props for {@link WallActivityRings}. */
export interface WallActivityRingsProps {
  /**
   * Today's strength dataset. Used to derive today's totals + streak
   * counts per exercise. Pass `null` when no data has loaded (or when
   * Supabase reads fail) — the fixture renders ghost rings + zero
   * tallies so the wall still reads as "in use."
   */
  data?: WeightRoomData | null
}

const FRAME_X = 340
const FRAME_Y = 60
const FRAME_W = 320
const FRAME_H = 260

const RING_CX = FRAME_X + FRAME_W / 2
const RING_CY = FRAME_Y + 130
const OUTER_RADIUS = 58
const RING_STROKE = 14
const RING_GAP = 4
const MIN_RING_STROKE = 4
const MIN_RING_GAP = 1
const TRACK_OPACITY = 0.2

/**
 * Pick a `stroke` + `gap` that fit every configured ring inside
 * {@link OUTER_RADIUS}. Mirrors `fitRingDimensions` in the Log View's
 * {@link import('../../weight-room/ActivityRings').ActivityRings} so this
 * decorative wall fixture renders *every* goal instead of silently
 * dropping the inner rings once the count passes three — pushups,
 * pullups, squats plus an active monthly-focus lane already make four,
 * and the fixed geometry pushed the fourth ring below the render cutoff.
 * Defaults to the generous (`RING_STROKE`, `RING_GAP`) sizes for the
 * common 1–2 goal case and shrinks toward (`MIN_RING_STROKE`,
 * `MIN_RING_GAP`) as goals accumulate.
 *
 * @param availableRadius Radius of the outermost ring's centerline —
 *   {@link OUTER_RADIUS} for this fixture.
 * @param ringCount Number of concentric rings to fit.
 */
function fitRingDimensions(
  availableRadius: number,
  ringCount: number,
): { stroke: number; gap: number } {
  if (ringCount <= 0) return { stroke: RING_STROKE, gap: RING_GAP }
  const requiredStroke = Math.floor(availableRadius / (ringCount * 1.6))
  const stroke = Math.max(MIN_RING_STROKE, Math.min(RING_STROKE, requiredStroke))
  const gap = Math.max(MIN_RING_GAP, Math.min(RING_GAP, Math.floor(stroke * 0.3)))
  return { stroke, gap }
}

/**
 * Wall-mounted "today's progress" fixture for the Weight Room scene
 * (#197). Renders a cream board above the squat rack containing the
 * concentric activity rings + per-exercise streak readouts so visitors
 * see the room "in use." Empty state (no data) shows ghost rings + zero
 * tallies — the wall still feels populated.
 *
 * Pure SVG primitives (no `<foreignObject>`) so the fixture scales
 * cleanly with the scene's `preserveAspectRatio="xMidYMid meet"`. Ring
 * geometry mirrors {@link import('../../weight-room/ActivityRings').ActivityRings}
 * — same math, scene-tuned dimensions.
 *
 * Data hydrates from {@link WeightRoomData}. Goals + sets get reduced
 * to today's totals + current streaks in this component; no upstream
 * derivation needed.
 */
export function WallActivityRings({
  data,
}: WallActivityRingsProps = {}): JSX.Element {
  // "Today" needs to be evaluated in the *viewer's* timezone, not the
  // server's (Vercel functions run in UTC). Deferring `now` to a
  // post-mount `useEffect` keeps SSR and the first client render
  // identical (both see `null` → ghost rings) so there's no hydration
  // mismatch. After hydration the effect sets the real viewer clock
  // and the rings re-render with today's correct totals + streaks.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: the viewer's clock must be read post-mount (see comment above) to keep SSR and first client render identical
    setNow(new Date())
  }, [])

  const goals = data?.goals ?? []
  const sets = data?.sets ?? []
  const todayKey = now ? toLocalDateKey(now) : null
  const setsToday = todayKey ? filterSetsForDay(sets, todayKey) : []
  const totals = totalsByExercise(setsToday)
  const streaks = now ? computeStrengthStreaks(sets, goals, now) : {}

  const rings = goals.map((goal) => ({
    exercise: goal.exercise,
    color: goal.color,
    target: goal.daily_target,
    total: totals.get(goal.exercise) ?? 0,
    streak: streaks[goal.exercise]?.current ?? 0,
  }))

  const primary = rings[0]
  const primaryPercent =
    primary && primary.target > 0
      ? Math.min(1, primary.total / primary.target)
      : 0

  // Auto-fit stroke/gap so every configured goal renders a ring. The old
  // fixed geometry dropped any ring past the third (a permanent squats
  // goal vanished the moment the shrugs focus lane pushed the count to
  // four); this mirrors the Log View's auto-fit.
  const { stroke: ringStroke, gap: ringGap } = fitRingDimensions(
    OUTER_RADIUS,
    rings.length,
  )

  // Tally band — the per-exercise labels stack below the rings inside the
  // board's lower margin. Spacing + font shrink with the goal count so a
  // 4-goal wall labels every ring instead of the old hard `slice(0, 2)`,
  // which left the inner rings anonymous.
  const ringsBottom = RING_CY + OUTER_RADIUS + ringStroke / 2
  const tallyTop = ringsBottom + 6
  const tallyBandHeight = Math.max(0, FRAME_Y + FRAME_H - 12 - tallyTop)
  const tallySpacing =
    rings.length > 0 ? Math.min(22, tallyBandHeight / rings.length) : 22
  const tallyFontSize = Math.max(10, Math.min(16, Math.round(tallySpacing * 0.72)))

  return (
    <g aria-hidden="true">
      {/* Board frame */}
      <RoughRect
        x={FRAME_X}
        y={FRAME_Y}
        width={FRAME_W}
        height={FRAME_H}
        fill={SCENE_PALETTE.ink}
        fillStyle="solid"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={3}
        roughness={1.0}
        seed={420}
      />
      {/* Inner ghost frame */}
      <RoughRect
        x={FRAME_X + 10}
        y={FRAME_Y + 10}
        width={FRAME_W - 20}
        height={FRAME_H - 20}
        fill="none"
        stroke={SCENE_PALETTE.rim}
        strokeWidth={1}
        roughness={0.8}
        seed={421}
      />

      {/* Header — "TODAY" letterspacing matches PRD's editorial mono */}
      <text
        x={RING_CX}
        y={FRAME_Y + 40}
        textAnchor="middle"
        fill={SCENE_PALETTE.rimSoft}
        fontFamily={HANDWRITING_FONT}
        fontSize={22}
        letterSpacing="0.32em"
      >
        today
      </text>

      {/* Rings — rotated -90deg around the center so 0% is at 12 o'clock */}
      {rings.length > 0 ? (
        <g transform={`rotate(-90 ${RING_CX} ${RING_CY})`}>
          {rings.map((ring, i) => {
            // Clamp to a positive radius so the innermost ring still
            // renders for pathological goal counts; `fitRingDimensions`
            // already shrank stroke/gap to keep this in range.
            const radius = Math.max(
              ringStroke / 2,
              OUTER_RADIUS - i * (ringStroke + ringGap),
            )
            const circumference = 2 * Math.PI * radius
            const rawPercent =
              ring.target > 0 ? ring.total / ring.target : 0
            const clamped = Math.min(1, Math.max(0, rawPercent))
            const dashOffset = circumference * (1 - clamped)
            return (
              <g key={ring.exercise} data-testid={`wall-ring-${ring.exercise}`}>
                {/* Track */}
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeOpacity={TRACK_OPACITY}
                  strokeWidth={ringStroke}
                />
                {/* Progress arc */}
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={ringStroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </g>
            )
          })}
        </g>
      ) : (
        // Empty-state ghost rings — dashed outlines so the wall still
        // reads as a populated fixture before any goal is configured.
        <>
          <circle
            cx={RING_CX}
            cy={RING_CY}
            r={OUTER_RADIUS}
            fill="none"
            stroke={SCENE_PALETTE.rim}
            strokeOpacity={0.3}
            strokeWidth={RING_STROKE}
            strokeDasharray="6 6"
          />
          <circle
            cx={RING_CX}
            cy={RING_CY}
            r={OUTER_RADIUS - RING_STROKE - RING_GAP}
            fill="none"
            stroke={SCENE_PALETTE.rim}
            strokeOpacity={0.3}
            strokeWidth={RING_STROKE}
            strokeDasharray="6 6"
          />
        </>
      )}

      {/* Center percent readout — anchored to the primary (outermost) ring */}
      {primary ? (
        <text
          x={RING_CX}
          y={RING_CY + 7}
          textAnchor="middle"
          fill={SCENE_PALETTE.creamBright}
          fontFamily={HANDWRITING_FONT}
          fontSize={22}
          fontWeight={700}
        >
          {Math.round(primaryPercent * 100)}%
        </text>
      ) : (
        <text
          x={RING_CX}
          y={RING_CY + 7}
          textAnchor="middle"
          fill={SCENE_PALETTE.rimSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={18}
        >
          --
        </text>
      )}

      {/* Per-exercise tallies + streak under the rings */}
      {rings.length > 0 ? (
        rings.map((ring, i) => (
          <text
            key={`tally-${ring.exercise}`}
            data-testid={`wall-tally-${ring.exercise}`}
            x={RING_CX}
            y={tallyTop + tallySpacing * (i + 0.85)}
            textAnchor="middle"
            fill={ring.color}
            fontFamily={HANDWRITING_FONT}
            fontSize={tallyFontSize}
          >
            {ring.exercise} {ring.total}/{ring.target}
            {ring.streak > 0 ? `  ·  🔥${ring.streak}d` : ''}
          </text>
        ))
      ) : (
        <text
          x={RING_CX}
          y={FRAME_Y + FRAME_H - 32}
          textAnchor="middle"
          fill={SCENE_PALETTE.rimSoft}
          fontFamily={HANDWRITING_FONT}
          fontSize={14}
        >
          no goals yet
        </text>
      )}
    </g>
  )
}
