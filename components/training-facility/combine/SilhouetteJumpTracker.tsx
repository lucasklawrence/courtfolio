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
/** Standing-pose body height as a fraction of standing reach (head crown vs fingertip-overhead). */
const STANDING_BODY_HEIGHT_RATIO = 0.91

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
 * Renders a side-profile basketball player anchored to a ground line. The
 * latest jump silhouette sits frozen at peak height in solid rim-orange and
 * is labeled with date + inches; a faint standing-pose silhouette anchors
 * the floor as a "you start here" reference.
 *
 * **Idle state** (no hover, no focus inside): only the standing silhouette
 * and the latest jump silhouette are visible — keeps the view clean when
 * historical jumps are clustered within a few inches and would otherwise
 * pile into a single overlay.
 *
 * **Active state** (mouse over the panel OR keyboard focus inside any
 * silhouette): the standing silhouette fades out, older jump silhouettes
 * ghost in as a faded "trail" at their respective peak heights (staggered
 * newest-to-oldest), and the latest silhouette plays a peak ↔ floor jump
 * cycle on loop with a land-squash on each return — so the static stack
 * becomes an animated jump in progress. On idle return, every silhouette
 * settles back to its frozen peak.
 *
 * `prefers-reduced-motion` collapses the cycle to a static toggle: hover
 * still reveals the trail, but the latest figure stays at peak. Each
 * silhouette also carries a `<title>` and aria-label for screen readers,
 * and a corner tooltip surfaces date / vertical / bodyweight on
 * hover/focus.
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
  const [isMouseOver, setIsMouseOver] = useState(false)

  // The panel is "active" whenever the mouse is over its bounds OR any
  // silhouette inside has keyboard focus. Reveals the trail and starts the
  // jump cycle.
  const isActive = isMouseOver || hovered !== null

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
  const olderJumps = jumps.slice(0, -1)

  // Size the viewBox + y-axis from the *peak* historical jump, not the latest.
  // If the athlete regresses (a later session lower than a prior peak), an
  // older silhouette would otherwise clip off the top of the viewBox and the
  // axis cap would understate the rendered range.
  const peakVerticalIn = jumps.reduce((max, j) => (j.verticalIn > max ? j.verticalIn : max), 0)
  const peakJumpTouch = peakVerticalIn + standingReachIn
  const viewHeightIn = Math.max(peakJumpTouch + HEADROOM_IN, standingReachIn + 24)
  const floorY = viewHeightIn - 0.5
  const standingReachY = floorY - standingReachIn

  // Y-axis ticks every 6" above the standing reach line.
  // Cap at the highest historical jump + a hair so the top tick reads sanely
  // even when the latest session was a regression.
  const maxAxisIn = Math.ceil((peakVerticalIn + 6) / 6) * 6
  const tickInches: number[] = []
  for (let inches = 0; inches <= maxAxisIn; inches += 6) {
    tickInches.push(inches)
  }

  // Latest silhouette positioning (final, peak-of-jump pose)
  const latestTopY = floorY - (latest.verticalIn + standingReachIn)
  const latestBottomY = floorY - latest.verticalIn
  const latestAccessibleLabel = buildAccessibleLabel(latest)

  // Animation state for the latest silhouette.
  // Mount: rise from floor with over-and-settle (one-time entrance).
  // Idle: hold at peak (y=0, scaleY=1).
  // Active (no reduce-motion): peak ↔ floor cycle on loop with land squash.
  const latestInitialState = reduceMotion ? false : { y: latest.verticalIn, scaleY: 0.86 }
  const latestAnimateState =
    isActive && !reduceMotion
      ? {
          y: [0, latest.verticalIn, 0],
          scaleY: [1, 0.85, 1],
        }
      : { y: 0, scaleY: 1 }
  const latestTransition =
    isActive && !reduceMotion
      ? {
          // easeIn on descent (gravity accel), easeOut on rise (deceleration toward peak).
          duration: 1.6,
          times: [0, 0.4, 1],
          ease: ['easeIn', 'easeOut'] as ['easeIn', 'easeOut'],
          repeat: Infinity,
        }
      : {
          duration: 1.1,
          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
          times: [0, 0.65, 1],
        }

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsMouseOver(true)}
      onMouseLeave={() => {
        setIsMouseOver(false)
        setHovered(null)
      }}
    >
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

        {/* Standing silhouette — visible idle as a "ground anchor"; fades out
            when the panel becomes active so the cycle has a clean stage. */}
        <motion.g
          animate={{ opacity: isActive ? 0 : 0.5 }}
          transition={{ duration: 0.4 }}
          aria-hidden="true"
        >
          <Silhouette
            cx={FIGURE_CX}
            topY={floorY - standingReachIn * STANDING_BODY_HEIGHT_RATIO}
            bottomY={floorY}
            pose="standing"
            color={chartPalette.courtLineCream}
          />
        </motion.g>

        {/* Older jump silhouettes — hidden idle; ghost in on active as a
            staggered trail. Newest-older fades in first so the eye reads
            them as "the recent journey to the latest peak." */}
        {olderJumps.map((entry, i) => {
          const finalTopY = floorY - (entry.verticalIn + standingReachIn)
          const finalBottomY = floorY - entry.verticalIn
          const trailOpacity = freshnessOpacity(i, olderJumps.length, 0.2) * 0.7
          const accessibleLabel = buildAccessibleLabel(entry)
          const isHovered = hovered?.date === entry.date
          // Stagger newest-to-oldest: most-recent older first, then back through history.
          const stagger = (olderJumps.length - 1 - i) * 0.08

          return (
            <motion.g
              key={entry.date}
              role="button"
              tabIndex={isActive ? 0 : -1}
              aria-label={accessibleLabel}
              aria-hidden={isActive ? undefined : true}
              onMouseEnter={() => setHovered(entry)}
              onMouseLeave={() => setHovered((h) => (h?.date === entry.date ? null : h))}
              onFocus={() => setHovered(entry)}
              onBlur={() => setHovered((h) => (h?.date === entry.date ? null : h))}
              animate={{
                opacity: isActive ? (isHovered ? Math.min(1, trailOpacity + 0.25) : trailOpacity) : 0,
              }}
              transition={{
                duration: 0.45,
                delay: isActive && !reduceMotion ? 0.25 + stagger : 0,
              }}
              style={{ cursor: 'pointer', pointerEvents: isActive ? 'auto' : 'none' }}
            >
              <title>{accessibleLabel}</title>
              <Silhouette
                cx={FIGURE_CX}
                topY={finalTopY}
                bottomY={finalBottomY}
                pose="apex"
                color={chartPalette.courtLineCream}
              />
            </motion.g>
          )
        })}

        {/* Latest jump silhouette — frozen at peak idle, jumping on loop
            when the panel is active. */}
        <motion.g
          role="button"
          tabIndex={0}
          aria-label={latestAccessibleLabel}
          onMouseEnter={() => setHovered(latest)}
          onMouseLeave={() => setHovered((h) => (h?.date === latest.date ? null : h))}
          onFocus={() => setHovered(latest)}
          onBlur={() => setHovered((h) => (h?.date === latest.date ? null : h))}
          initial={latestInitialState}
          animate={latestAnimateState}
          transition={latestTransition}
          style={{
            cursor: 'pointer',
            transformBox: 'fill-box',
            transformOrigin: 'center bottom',
          }}
        >
          <title>{latestAccessibleLabel}</title>
          <Silhouette
            cx={FIGURE_CX}
            topY={latestTopY}
            bottomY={latestBottomY}
            pose="apex"
            color={chartPalette.rimOrange}
          />
        </motion.g>

        {/* Latest jump label — fixed at the peak-fingertip position so it
            doesn't bounce with the cycle. Fades out when active so the
            label doesn't clutter the animated state. */}
        <motion.text
          x={FIGURE_CX + 8}
          y={latestTopY + 2.5}
          fontSize={3}
          fill={chartPalette.rimOrange}
          fontFamily="var(--font-patrick-hand, 'Patrick Hand', cursive)"
          animate={{ opacity: isActive ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {formatLatestLabel(latest)}
        </motion.text>
      </svg>

      {hovered && (
        <div
          role="tooltip"
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

/**
 * Build the per-silhouette aria-label exposing date + vertical (+ bodyweight
 * when logged). Keeps the date prefix consistent so screen-reader navigation
 * by-button reads as a chronological list.
 */
function buildAccessibleLabel(entry: JumpEntry): string {
  const parts = [`Vertical: ${entry.verticalIn}"`]
  if (entry.bodyweightLbs !== undefined) {
    parts.push(`Bodyweight: ${entry.bodyweightLbs} lbs`)
  }
  return `${entry.date} jump — ${parts.join(', ')}`
}
