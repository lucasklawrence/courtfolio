'use client'

import { useState, type JSX } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import { STANDING_REACH_IN } from '@/constants/movement'
import type { Benchmark } from '@/types/movement'
import {
  freshnessOpacity,
  selectJumpEntries,
  type JumpEntry,
} from './jump-tracker-utils'
import { Silhouette } from './Silhouette'

/** Props for {@link SilhouetteJumpTracker}. */
export interface SilhouetteJumpTrackerProps {
  /** Full benchmark history. Filtered/sorted internally — pass it raw. */
  entries: readonly Benchmark[]
  /** Override standing reach in inches. Defaults to {@link STANDING_REACH_IN}. */
  standingReachIn?: number
  /** Tailwind classes appended to the outer wrapper. */
  className?: string
  /** Accessible name for the SVG region. Override per use site. */
  ariaLabel?: string
}

/** SVG viewBox width in inches. The figure column lives at the left, the y-axis on the right. */
const VIEW_W_IN = 70
/** Where the figure's central vertical axis sits inside the viewBox (inches). */
const FIGURE_CX = 26
/** Where the y-axis spine sits — just past the figure column. */
const AXIS_X = 50
/** Visual cushion above the tallest jump-touch so the fingertip never kisses the top edge. */
const HEADROOM_IN = 12

/**
 * Format the latest-jump callout text.
 * Date is shortened to `MMM DD` so the label fits beside a 4"-wide silhouette
 * without overflowing the figure column.
 */
function formatLatestLabel(entry: JumpEntry): string {
  const [, monthStr, dayStr] = entry.date.split('-')
  const monthIndex = Number(monthStr) - 1
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthLabel = months[monthIndex] ?? monthStr
  return `${monthLabel} ${Number(dayStr)} · ${entry.verticalIn}"`
}

/**
 * `SilhouetteJumpTracker` — PRD §9.3 signature visualization.
 *
 * Renders a side-profile basketball player anchored to a ground line with
 * frozen jump silhouettes stacked at peak height. The latest jump is solid
 * rim-orange and labeled with date + inches; older jumps fade behind it
 * toward grey/cream. A dashed standing-reach line marks the anatomical
 * baseline; the right-edge axis ticks every 6" above that line.
 *
 * On mount the latest silhouette rises from the floor with an
 * over-and-settle keyframe (no library — just `animate` keyframes), then
 * older silhouettes fade in lowest-to-highest. `prefers-reduced-motion`
 * collapses every animation to an instant render.
 *
 * Hover, focus, or tap a frozen silhouette to surface its date / vertical /
 * bodyweight in a corner tooltip. Each silhouette also carries a `<title>`
 * for screen readers and native browser hover.
 */
export function SilhouetteJumpTracker({
  entries,
  standingReachIn = STANDING_REACH_IN,
  className = '',
  ariaLabel = 'Silhouette jump tracker — frozen jumps stacked at peak heights',
}: SilhouetteJumpTrackerProps): JSX.Element {
  const reduceMotion = useReducedMotion()
  const jumps = selectJumpEntries(entries)
  const [hovered, setHovered] = useState<JumpEntry | null>(null)

  if (jumps.length === 0) {
    return (
      <div
        role="status"
        aria-label="No jump data"
        className={`flex min-h-[260px] items-center justify-center rounded-xl border border-amber-300/20 bg-black/30 p-6 text-sm text-amber-200/70 ${className}`}
      >
        No jumps logged yet — the silhouette stack appears once a vertical benchmark is recorded.
      </div>
    )
  }

  const latest = jumps[jumps.length - 1]
  const maxJumpTouch = latest.verticalIn + standingReachIn
  const viewHeightIn = Math.max(maxJumpTouch + HEADROOM_IN, standingReachIn + 24)
  const floorY = viewHeightIn - 0.5
  const standingReachY = floorY - standingReachIn

  // Y-axis ticks every 6" above the standing reach line.
  // Cap at the highest jump-touch + a hair so the top tick reads sanely.
  const maxAxisIn = Math.ceil((latest.verticalIn + 6) / 6) * 6
  const tickInches: number[] = []
  for (let inches = 0; inches <= maxAxisIn; inches += 6) {
    tickInches.push(inches)
  }

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

        {/* Floor */}
        <line
          x1={2}
          y1={floorY}
          x2={VIEW_W_IN - 2}
          y2={floorY}
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.6}
          opacity={0.85}
        />

        {/* Dashed standing-reach line */}
        <line
          x1={4}
          y1={standingReachY}
          x2={VIEW_W_IN - 4}
          y2={standingReachY}
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.3}
          strokeDasharray="1.5 1.5"
          opacity={0.55}
        />
        <text
          x={4}
          y={standingReachY - 1.2}
          fontSize={2.6}
          fill={chartPalette.courtLineCream}
          opacity={0.7}
          fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
        >
          standing reach · {standingReachIn}&quot;
        </text>

        {/* Y-axis spine + ticks (right-side, inches above standing reach) */}
        <line
          x1={AXIS_X}
          y1={standingReachY}
          x2={AXIS_X}
          y2={standingReachY - maxAxisIn}
          stroke={chartPalette.courtLineCream}
          strokeWidth={0.4}
          opacity={0.6}
        />
        {tickInches.map((inches) => {
          const y = standingReachY - inches
          return (
            <g key={`tick-${inches}`} aria-hidden="true">
              <line
                x1={AXIS_X}
                y1={y}
                x2={AXIS_X + 1.5}
                y2={y}
                stroke={chartPalette.courtLineCream}
                strokeWidth={0.3}
                opacity={0.6}
              />
              <text
                x={AXIS_X + 2.2}
                y={y + 1}
                fontSize={2.4}
                fill={chartPalette.courtLineCream}
                opacity={0.75}
                fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
              >
                +{inches}&quot;
              </text>
            </g>
          )
        })}

        {/* Standing silhouette — anchored to the floor, head at standing reach */}
        <Silhouette
          cx={FIGURE_CX}
          topY={standingReachY}
          bottomY={floorY}
          color={chartPalette.courtLineCream}
          opacity={0.32}
        />

        {/* Frozen jump silhouettes, oldest → newest. Latest renders on top. */}
        {jumps.map((entry, i) => {
          const isLatest = i === jumps.length - 1
          const isHovered = hovered?.date === entry.date
          const baseOpacity = isLatest ? 1 : freshnessOpacity(i, jumps.length) * 0.7
          const color = isLatest ? chartPalette.rimOrange : chartPalette.courtLineCream
          const finalTopY = floorY - (entry.verticalIn + standingReachIn)
          const finalBottomY = floorY - entry.verticalIn

          // Latest: rise from floor with a parabolic over-and-settle.
          // Older: fade in at final position, lowest-to-highest after the latest lands.
          const initialState = reduceMotion
            ? false
            : isLatest
              ? { y: entry.verticalIn, scaleY: 0.86 }
              : { opacity: 0 }
          const animateState = reduceMotion
            ? undefined
            : isLatest
              ? {
                  y: [entry.verticalIn, -entry.verticalIn * 0.05, 0],
                  scaleY: [0.86, 1, 1],
                }
              : { opacity: baseOpacity }
          const transition = reduceMotion
            ? undefined
            : isLatest
              ? { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const, times: [0, 0.65, 1] }
              : { duration: 0.6, delay: 1.0 + i * 0.18 }

          const tooltipParts = [
            entry.date,
            `Vertical: ${entry.verticalIn}"`,
            entry.bodyweightLbs !== undefined ? `Bodyweight: ${entry.bodyweightLbs} lbs` : null,
          ].filter((s): s is string => Boolean(s))
          const accessibleLabel = `${entry.date} jump — ${tooltipParts.slice(1).join(', ')}`

          return (
            <motion.g
              key={entry.date}
              role="button"
              tabIndex={0}
              aria-label={accessibleLabel}
              onMouseEnter={() => setHovered(entry)}
              onMouseLeave={() => setHovered((h) => (h?.date === entry.date ? null : h))}
              onFocus={() => setHovered(entry)}
              onBlur={() => setHovered((h) => (h?.date === entry.date ? null : h))}
              onClick={() => setHovered((h) => (h?.date === entry.date ? null : entry))}
              style={{
                cursor: 'pointer',
                transformBox: 'fill-box',
                transformOrigin: 'center bottom',
                outline: 'none',
              }}
              initial={initialState}
              animate={animateState}
              transition={transition}
            >
              <title>{accessibleLabel}</title>
              <Silhouette
                cx={FIGURE_CX}
                topY={finalTopY}
                bottomY={finalBottomY}
                color={color}
                opacity={isHovered ? Math.min(1, baseOpacity + 0.25) : baseOpacity}
              />
              {isLatest && (
                <text
                  x={FIGURE_CX + 8}
                  y={finalTopY + 2.5}
                  fontSize={3}
                  fill={chartPalette.rimOrange}
                  fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
                >
                  {formatLatestLabel(entry)}
                </text>
              )}
            </motion.g>
          )
        })}
      </svg>

      {hovered && (
        <div
          role="tooltip"
          aria-live="polite"
          className="pointer-events-none absolute right-3 top-3 rounded-md border border-amber-300/40 bg-black/85 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-100 shadow-[0_4px_18px_-6px_rgba(0,0,0,0.7)]"
        >
          <div className="text-amber-300">{hovered.date}</div>
          <div className="mt-1">Vertical · {hovered.verticalIn}&quot;</div>
          <div>
            Bodyweight ·{' '}
            {hovered.bodyweightLbs !== undefined ? `${hovered.bodyweightLbs} lbs` : '—'}
          </div>
        </div>
      )}
    </div>
  )
}
