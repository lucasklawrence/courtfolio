'use client'

import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import {
  classifyDelta,
  type DeltaStatus,
  type ScoreboardCell,
} from './scoreboard-utils'

export {
  SCOREBOARD_METRIC_ORDER,
  classifyDelta,
  deriveCombineScoreboardCells,
  pickMetricBaseline,
  pickMetricLatest,
  type DeltaStatus,
  type ScoreboardCell,
} from './scoreboard-utils'

/** Props for {@link Scoreboard}. */
export interface ScoreboardProps {
  /** Cells rendered left-to-right. Length is unconstrained — the Combine view supplies four. */
  cells: readonly ScoreboardCell[]
  /**
   * Accessible name for the scoreboard region. Override per use site —
   * the Combine page sets "Combine scoreboard summary"; the future Gym
   * wall scoreboard will set its own contextual label. Defaults to a
   * generic "Scoreboard" so consumers that forget still get something
   * sensible.
   */
  ariaLabel?: string
  /** Tailwind classes appended to the outer container. */
  className?: string
}

const CELL_STAGGER_S = 0.4
const DIGIT_STAGGER_S = 0.05
const DIGIT_FLIP_S = 0.45
const DELTA_COUNTUP_S = 0.6
const DELTA_DELAY_AFTER_CELL_S = 0.3

/** Format the cell's main value, or em-dash placeholder when absent. */
function formatValue(
  value: number | undefined,
  precision: number,
  unit: string,
): string {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(precision)}${unit}`
}

/** Format a signed delta with a leading +/− glyph and the metric unit. */
function formatDeltaValue(delta: number, precision: number, unit: string): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  const abs = Math.abs(delta)
  return `${sign}${abs.toFixed(precision)}${unit}`
}

/**
 * `Scoreboard` — arena-style summary header (PRD §9.1).
 *
 * Renders cells side-by-side. Each cell shows a label, the latest value
 * in scoreboard digits, and a delta-vs-baseline line color-coded by
 * direction-of-improvement. On mount, digits flip in cell-by-cell
 * (split-flap style) and the delta counts up from zero.
 *
 * The component is pure display: parents derive cell models with
 * `deriveCombineScoreboardCells` (Combine page) or hand-build them
 * (Gym wall scoreboard, future). See {@link ScoreboardProps} for prop docs.
 */
export function Scoreboard({
  cells,
  ariaLabel = 'Scoreboard',
  className = '',
}: ScoreboardProps): JSX.Element {
  const reduceMotion = useReducedMotion()
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-amber-300/40 bg-black/85 shadow-[0_12px_36px_-16px_rgba(0,0,0,0.7)] sm:grid-cols-4 ${className}`}
    >
      {cells.map((cell, index) => (
        <ScoreboardCellView
          key={cell.label}
          cell={cell}
          index={index}
          reduceMotion={!!reduceMotion}
        />
      ))}
    </div>
  )
}

interface ScoreboardCellViewProps {
  cell: ScoreboardCell
  index: number
  reduceMotion: boolean
}

function ScoreboardCellView({
  cell,
  index,
  reduceMotion,
}: ScoreboardCellViewProps): JSX.Element {
  const display = formatValue(cell.value, cell.precision, cell.unit)
  const status = classifyDelta(cell.value, cell.baseline, cell.direction)
  // Suppress the delta line when there's no comparison to make OR the
  // values are exactly equal — a "Δ ±0.00s" line on the first session
  // (when baseline === latest === today's value) reads as noise.
  const delta =
    cell.value !== undefined && cell.baseline !== undefined
      ? cell.value - cell.baseline
      : undefined
  const showDelta = delta !== undefined && delta !== 0 && status !== null
  const cellDelay = reduceMotion ? 0 : index * CELL_STAGGER_S

  return (
    <div className="flex flex-col items-center gap-2 bg-neutral-950 px-4 py-5">
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
        {cell.label}
      </span>
      <SplitFlapDigits text={display} delay={cellDelay} reduceMotion={reduceMotion} />
      {showDelta ? (
        <DeltaLine
          delta={delta as number}
          status={status as DeltaStatus}
          precision={cell.precision}
          unit={cell.unit}
          delay={cellDelay + (reduceMotion ? 0 : DELTA_DELAY_AFTER_CELL_S)}
          reduceMotion={reduceMotion}
        />
      ) : (
        // Reserved spacer keeps cell heights uniform so the scoreboard
        // stays aligned even when some cells lack a delta.
        <span aria-hidden="true" className="block h-4" />
      )}
    </div>
  )
}

interface SplitFlapDigitsProps {
  text: string
  delay: number
  reduceMotion: boolean
}

const DIGIT_STYLE: CSSProperties = {
  display: 'inline-block',
  transformOrigin: 'center top',
  transformStyle: 'preserve-3d',
}

/**
 * Renders a string as a row of split-flap-style digits, each flipping
 * down into place with a small per-character stagger.
 */
function SplitFlapDigits({
  text,
  delay,
  reduceMotion,
}: SplitFlapDigitsProps): JSX.Element {
  const chars = Array.from(text)
  return (
    <span
      aria-label={text}
      className="font-mono text-3xl font-bold tabular-nums tracking-tight text-amber-300 sm:text-4xl"
      style={{ perspective: '600px' }}
    >
      {chars.map((char, i) => (
        <motion.span
          // Key includes the text identity so a future value swap on the
          // same cell retriggers the flip animation; with just `i` the
          // span would mutate without re-animating.
          key={`${text}-${i}`}
          aria-hidden="true"
          style={DIGIT_STYLE}
          initial={reduceMotion ? false : { rotateX: -90, opacity: 0 }}
          animate={reduceMotion ? undefined : { rotateX: 0, opacity: 1 }}
          transition={{
            duration: DIGIT_FLIP_S,
            ease: [0.16, 1, 0.3, 1],
            delay: delay + i * DIGIT_STAGGER_S,
          }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  )
}

interface DeltaLineProps {
  delta: number
  status: DeltaStatus
  precision: number
  unit: string
  delay: number
  reduceMotion: boolean
}

/**
 * Single delta line that counts up from zero to the final value on
 * mount. With reduced motion, jumps to the final value immediately.
 */
function DeltaLine({
  delta,
  status,
  precision,
  unit,
  delay,
  reduceMotion,
}: DeltaLineProps): JSX.Element {
  const motionValue = useMotionValue(reduceMotion ? delta : 0)
  const [text, setText] = useState(() =>
    formatDeltaValue(reduceMotion ? delta : 0, precision, unit),
  )

  useMotionValueEvent(motionValue, 'change', (v) => {
    setText(formatDeltaValue(v, precision, unit))
  })

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(delta)
      return
    }
    motionValue.set(0)
    const controls = animate(motionValue, delta, {
      duration: DELTA_COUNTUP_S,
      delay,
      ease: 'easeOut',
    })
    return () => {
      controls.stop()
    }
  }, [delta, delay, reduceMotion, motionValue])

  const colorClass =
    status === 'improvement'
      ? 'text-emerald-400'
      : status === 'regression'
        ? 'text-rose-400'
        : 'text-amber-200/80'

  // No `role="status"` / `aria-live`: this is a static value that
  // animates visually on mount, not a live update. With four cells
  // counting up simultaneously a polite live region would queue a flood
  // of announcements during the entrance animation.
  return (
    <span
      aria-label={`Delta ${text} versus baseline`}
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.2em] ${colorClass}`}
    >
      Δ {text}
    </span>
  )
}
