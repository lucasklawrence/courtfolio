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
const TRACK_OPACITY = 0.2

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
            const radius = OUTER_RADIUS - i * (RING_STROKE + RING_GAP)
            if (radius < RING_STROKE / 2) return null
            const circumference = 2 * Math.PI * radius
            const rawPercent =
              ring.target > 0 ? ring.total / ring.target : 0
            const clamped = Math.min(1, Math.max(0, rawPercent))
            const dashOffset = circumference * (1 - clamped)
            return (
              <g key={ring.exercise}>
                {/* Track */}
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeOpacity={TRACK_OPACITY}
                  strokeWidth={RING_STROKE}
                />
                {/* Progress arc */}
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={RING_STROKE}
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
        rings.slice(0, 2).map((ring, i) => (
          <text
            key={`tally-${ring.exercise}`}
            x={RING_CX}
            y={FRAME_Y + FRAME_H - 50 + i * 22}
            textAnchor="middle"
            fill={ring.color}
            fontFamily={HANDWRITING_FONT}
            fontSize={16}
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
