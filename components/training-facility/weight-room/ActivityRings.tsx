import type { JSX } from 'react'

import type { ExerciseGoal } from '@/types/weight-room'

/** Per-exercise progress slice consumed by {@link ActivityRings}. */
export interface RingProgress {
  /** The configured goal — provides exercise name, target, and color. */
  goal: ExerciseGoal
  /** Total reps already logged for the exercise on the current day. */
  totalReps: number
}

/** Props for {@link ActivityRings}. */
export interface ActivityRingsProps {
  /**
   * One entry per exercise. The first entry renders as the outer
   * (largest) ring; subsequent entries shrink inward. The Today View
   * orders these by goal config so pushups (orange) is outermost and
   * pullups (teal) sits inside it — the activity-ring metaphor.
   */
  rings: readonly RingProgress[]
  /**
   * Render size in CSS pixels for the SVG's viewport. Defaults to 256.
   * The component still scales fluidly via CSS — `size` only sets the
   * intrinsic viewBox; the consumer can override with Tailwind's
   * `w-*` / `h-*` classes.
   */
  size?: number
  /**
   * Optional Tailwind classes appended to the outer wrapper. Lets the
   * parent place the rings inside its own grid cell without rewriting
   * the chrome.
   */
  className?: string
}

const RING_STROKE = 14
const RING_GAP = 4
const TRACK_OPACITY = 0.18

/**
 * SVG-based concentric activity rings — the Today View centerpiece
 * (#80). Each `RingProgress` entry contributes one ring; the first
 * entry is outermost. Stroke fills proportionally to `totalReps /
 * goal.daily_target` and clamps at one full revolution (a 110-rep day
 * stops at the goal visually, but the center text shows the raw
 * `total / goal` numbers so the over-fill is still visible).
 *
 * Goal-hit rings get a subtle drop-shadow glow (the issue's
 * "completion state: ring glows or pulses when daily goal is hit").
 * No CSS animation on first paint — the ring fills immediately, which
 * matches the static screenshot review the test plan calls for. Future
 * micro-interaction (a pulse on quick-log success) can hang off a
 * data-attribute toggled by the parent.
 *
 * Center text shows the *primary* exercise — the first entry in
 * `rings`. Ports the spec's "75 / 100" treatment so the ring tells
 * the at-a-glance story and the number tells the precise one.
 *
 * Order matters: the issue calls out outer = pushups (accent), inner
 * = pullups (secondary). The Today View hands `rings` over already
 * ordered, so this component just walks the array.
 */
export function ActivityRings({
  rings,
  size = 256,
  className = '',
}: ActivityRingsProps): JSX.Element {
  const center = size / 2
  const outerRadius = center - RING_STROKE / 2

  // Empty-state — no goals configured. Rare in practice (the migration
  // seeds two), but cheap to handle so the page doesn't blow up if
  // every default goal is deleted via the settings UI.
  if (rings.length === 0) {
    return (
      <div
        className={`relative flex aspect-square items-center justify-center rounded-full border border-dashed border-white/15 bg-black/30 text-center text-xs text-white/50 ${className}`}
        style={{ width: size, height: size }}
      >
        Add a goal in Settings to start tracking.
      </div>
    )
  }

  const primary = rings[0]
  const primaryPercentRaw =
    primary.goal.daily_target > 0 ? primary.totalReps / primary.goal.daily_target : 0
  const primaryPercentDisplay = Math.round(primaryPercentRaw * 100)

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      data-testid="activity-rings"
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Activity rings: ${rings
          .map(
            (r) =>
              `${r.goal.exercise} ${r.totalReps} of ${r.goal.daily_target}`,
          )
          .join(', ')}`}
        className="block w-full h-auto -rotate-90"
      >
        {rings.map((ring, i) => {
          const radius = outerRadius - i * (RING_STROKE + RING_GAP)
          if (radius <= RING_STROKE) return null
          const circumference = 2 * Math.PI * radius
          const rawPercent =
            ring.goal.daily_target > 0 ? ring.totalReps / ring.goal.daily_target : 0
          const clamped = Math.min(1, Math.max(0, rawPercent))
          const dashOffset = circumference * (1 - clamped)
          const isHit = rawPercent >= 1
          return (
            <g key={ring.goal.exercise} data-testid={`ring-${ring.goal.exercise}`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.goal.color}
                strokeOpacity={TRACK_OPACITY}
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.goal.color}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={
                  isHit
                    ? {
                        filter: `drop-shadow(0 0 6px ${ring.goal.color})`,
                        transition: 'stroke-dashoffset 600ms ease-out',
                      }
                    : { transition: 'stroke-dashoffset 600ms ease-out' }
                }
              />
            </g>
          )
        })}
      </svg>
      {/* Center readout — anchored to the primary (outermost) exercise.
          Absolute-positioned over the SVG so the ring sweep stays
          undisturbed and the SVG itself can rotate (-90deg) without
          flipping the text. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/55">
          {primary.goal.exercise}
        </span>
        <span className="mt-1 font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
          {primary.totalReps}
          <span className="text-white/40"> / {primary.goal.daily_target}</span>
        </span>
        <span
          className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: primary.goal.color }}
        >
          {primaryPercentDisplay}%
        </span>
      </div>
    </div>
  )
}
