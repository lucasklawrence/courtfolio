'use client'

import { type JSX } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import {
  RIM_HEIGHT_IN,
  STANDING_REACH_IN,
  inchesToRim,
  jumpTouchInches,
} from '@/constants/movement'
import type { Benchmark } from '@/types/movement'
import { selectJumpEntries } from './jump-tracker-utils'

/** Props for {@link CeilingView}. */
export interface CeilingViewProps {
  /** Full benchmark history. Filtered/sorted internally. */
  entries: readonly Benchmark[]
  /** Override standing reach in inches. Defaults to {@link STANDING_REACH_IN}. */
  standingReachIn?: number
  /** Override rim height in inches. Defaults to {@link RIM_HEIGHT_IN}. */
  rimHeightIn?: number
  /** Tailwind classes appended to the outer wrapper. */
  className?: string
  /** Accessible name for the SVG region. */
  ariaLabel?: string
}

const VIEW_W_IN = 32
/** Visual cushion above the rim so the backboard top isn't pinned to the canvas edge. */
const HEADROOM_IN = 12
const POLE_X = 27
const BACKBOARD_X = 14
const BACKBOARD_W = 13
const RIM_LEFT_X = 9
const BAR_X = 11
const BAR_W = 4
const BAR_BG_X = 9
const BAR_BG_W = 8
const NET_HEIGHT_IN = 5

/**
 * `CeilingView` — PRD §9.4 paired companion to the silhouette tracker.
 *
 * Renders a backboard + rim + net at regulation height with a vertical
 * jump-touch bar climbing from the floor toward it. The gap between the
 * top of the bar and the rim is annotated in inches; faint tick marks
 * across the bar mark prior months' tops so progress reads at a glance.
 *
 * When jump-touch reaches or exceeds rim height the gap annotation is
 * replaced by a "RIM TOUCH" callout and the rim pulses orange — a light
 * v1 milestone treatment in lieu of the full confetti celebration the
 * PRD floats. Confetti is deferred behind the actual milestone hitting.
 *
 * Accepts the same raw benchmark history shape as the silhouette tracker
 * and filters to complete entries with a `vertical_in` value.
 */
export function CeilingView({
  entries,
  standingReachIn = STANDING_REACH_IN,
  rimHeightIn = RIM_HEIGHT_IN,
  className = '',
  ariaLabel = 'Ceiling view — current jump-touch versus the rim',
}: CeilingViewProps): JSX.Element {
  const reduceMotion = useReducedMotion()
  const jumps = selectJumpEntries(entries)

  if (jumps.length === 0) {
    return (
      <div
        role="status"
        aria-label="No jump data"
        className={`flex min-h-[260px] items-center justify-center rounded-xl border border-amber-300/20 bg-black/30 p-6 text-sm text-amber-200/70 ${className}`}
      >
        No jumps logged yet — the rim gauge appears once a vertical benchmark is recorded.
      </div>
    )
  }

  const latest = jumps[jumps.length - 1]
  const latestJumpTouch = jumpTouchInches(latest.verticalIn, standingReachIn) ?? 0
  const reachedRim = latestJumpTouch >= rimHeightIn
  const gapToRim = inchesToRim(latestJumpTouch, rimHeightIn) ?? 0

  const viewHeightIn = rimHeightIn + HEADROOM_IN
  const floorY = viewHeightIn - 1.5
  const inchesToY = (inches: number): number => floorY - inches

  const rimY = inchesToY(rimHeightIn)
  const jumpTouchY = inchesToY(latestJumpTouch)

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_W_IN} ${viewHeightIn}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>

        {/* Hardwood tan column behind the bar — anchors the cream bar visually */}
        <rect
          x={BAR_BG_X}
          y={rimY}
          width={BAR_BG_W}
          height={floorY - rimY}
          fill={chartPalette.hardwoodTan}
          opacity={0.32}
          rx={0.5}
        />

        {/* Floor line */}
        <line
          x1={1}
          y1={floorY}
          x2={VIEW_W_IN - 1}
          y2={floorY}
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.5}
          opacity={0.85}
        />

        {/* Pole (back of the hoop assembly) */}
        <rect
          x={POLE_X}
          y={inchesToY(rimHeightIn + HEADROOM_IN - 2)}
          width={1.2}
          height={floorY - inchesToY(rimHeightIn + HEADROOM_IN - 2)}
          fill={chartPalette.inkBlack}
          opacity={0.85}
        />
        {/* Horizontal mounting arm */}
        <rect
          x={BACKBOARD_X + BACKBOARD_W}
          y={rimY - 1}
          width={POLE_X - (BACKBOARD_X + BACKBOARD_W)}
          height={1}
          fill={chartPalette.inkBlack}
          opacity={0.85}
        />

        {/* Backboard */}
        <rect
          x={BACKBOARD_X}
          y={rimY - 6}
          width={BACKBOARD_W}
          height={9}
          fill={chartPalette.courtLineCream}
          opacity={0.18}
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.4}
          rx={0.4}
        />
        {/* Backboard square (the painted small box above rim) */}
        <rect
          x={BACKBOARD_X + 4}
          y={rimY - 4.5}
          width={5}
          height={3.5}
          fill="none"
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.3}
          opacity={0.7}
        />

        {/* Rim */}
        <motion.line
          x1={RIM_LEFT_X}
          y1={rimY}
          x2={BACKBOARD_X}
          y2={rimY}
          stroke={chartPalette.rimOrange}
          strokeWidth={1.4}
          strokeLinecap="round"
          animate={
            reachedRim && !reduceMotion
              ? { opacity: [0.7, 1, 0.7] }
              : undefined
          }
          transition={
            reachedRim && !reduceMotion
              ? { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
              : undefined
          }
        />

        {/* Net — five stylized strands */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const startX = RIM_LEFT_X + t * (BACKBOARD_X - RIM_LEFT_X)
          const innerT = t < 0.5 ? t + 0.05 : t - 0.05
          const endX = RIM_LEFT_X + innerT * (BACKBOARD_X - RIM_LEFT_X)
          return (
            <line
              key={`net-${i}`}
              x1={startX}
              y1={rimY}
              x2={endX}
              y2={rimY + NET_HEIGHT_IN}
              stroke={chartPalette.courtLineCream}
              strokeWidth={0.25}
              opacity={0.7}
            />
          )
        })}
        {/* Net rim ring */}
        <line
          x1={RIM_LEFT_X}
          y1={rimY + NET_HEIGHT_IN * 0.55}
          x2={BACKBOARD_X}
          y2={rimY + NET_HEIGHT_IN * 0.55}
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.2}
          opacity={0.55}
        />

        {/* Prior-month tick marks across the bar — faint horizontal lines */}
        {jumps.slice(0, -1).map((j) => {
          const y = inchesToY((jumpTouchInches(j.verticalIn, standingReachIn) ?? 0))
          return (
            <line
              key={`prior-${j.date}`}
              x1={BAR_BG_X - 0.5}
              y1={y}
              x2={BAR_BG_X + BAR_BG_W + 0.5}
              y2={y}
              stroke={chartPalette.inkBlack}
              strokeWidth={0.25}
              opacity={0.45}
              strokeDasharray="0.8 0.8"
            />
          )
        })}

        {/* Cream bar from floor to current jump-touch */}
        <motion.rect
          x={BAR_X}
          y={jumpTouchY}
          width={BAR_W}
          height={floorY - jumpTouchY}
          fill={chartPalette.courtLineCream}
          rx={0.5}
          initial={reduceMotion ? false : { scaleY: 0, transformOrigin: 'bottom' }}
          animate={reduceMotion ? undefined : { scaleY: 1 }}
          transition={reduceMotion ? undefined : { duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
        />

        {/* Top-of-bar marker showing the latest jump-touch height */}
        <text
          x={BAR_X - 0.5}
          y={jumpTouchY - 1.2}
          fontSize={2.6}
          fill={chartPalette.courtLineCream}
          fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
        >
          {latestJumpTouch.toFixed(0)}&quot;
        </text>

        {/* Gap annotation — sits in the empty space between bar top and rim */}
        {!reachedRim && gapToRim > 0 && (
          <g aria-hidden="true">
            <line
              x1={BAR_X + BAR_W + 0.5}
              y1={jumpTouchY}
              x2={BAR_X + BAR_W + 0.5}
              y2={rimY}
              stroke={chartPalette.rimOrange}
              strokeWidth={0.3}
              opacity={0.6}
              strokeDasharray="0.6 0.6"
            />
            <text
              x={BAR_X + BAR_W + 1.4}
              y={(jumpTouchY + rimY) / 2 + 1}
              fontSize={2.8}
              fill={chartPalette.rimOrange}
              fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
            >
              {gapToRim.toFixed(0)}&quot; to rim
            </text>
          </g>
        )}

        {/* Milestone celebration: jump-touch ≥ rim */}
        {reachedRim && (
          <g>
            <motion.circle
              cx={(RIM_LEFT_X + BACKBOARD_X) / 2}
              cy={rimY}
              r={5}
              fill="none"
              stroke={chartPalette.rimOrange}
              strokeWidth={0.4}
              initial={reduceMotion ? false : { scale: 0.4, opacity: 0.9 }}
              animate={
                reduceMotion
                  ? { opacity: 0.6 }
                  : { scale: [0.4, 1.4, 0.4], opacity: [0.9, 0, 0.9] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 1.6, repeat: Infinity, ease: 'easeOut' }
              }
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
            <text
              x={BAR_X + BAR_W + 1.4}
              y={rimY - 1.5}
              fontSize={3.2}
              fill={chartPalette.rimOrange}
              fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
              fontWeight={700}
            >
              RIM TOUCH!
            </text>
          </g>
        )}
      </svg>

      {/* Static caption: matches the screen-reader summary so sighted users
          get the same numbers without leaning on the SVG label. */}
      <p className="mt-2 px-1 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300/80">
        Jump-touch · {latestJumpTouch.toFixed(0)}&quot;
        {reachedRim ? ' · rim reached' : ` · ${gapToRim.toFixed(0)}" to rim`}
      </p>
    </div>
  )
}
