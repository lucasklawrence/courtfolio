'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { JSX } from 'react'

/** Props for {@link PulsingHeart}. */
export interface PulsingHeartProps {
  /** Beats per minute that drives the cycle duration — `60_000 / bpm` ms per pulse so the visible beat matches the displayed number. */
  bpm: number
}

/**
 * Animated heart glyph (♥) that scales between 1.0 and 1.15 at the
 * cycle rate of `60_000 / bpm` ms — so a displayed 60 BPM beats once
 * per second, 90 BPM beats 1.5×/s, etc. Visibly tying the animation
 * frequency to the value is the point of PRD §7.4's pulse note.
 *
 * Renders as a `<tspan>` so it composes inline with surrounding label
 * text inside the same `<text>` element — the heart sits where it
 * would in `♥ resting hr` rather than as a standalone glyph that has
 * to be positionally hand-aligned.
 *
 * `transformBox: fill-box` + `transformOrigin: center` pivots the
 * scale around the inked glyph's center, so the heart pulses in place
 * regardless of where the parent `<text>` is positioned. (User-coord
 * `${x}px ${y}px` would be relative to the box's top-left under
 * `fill-box`, which sends the origin off the glyph and the pulse
 * appears to drift.)
 *
 * Honors `prefers-reduced-motion`: when the OS toggle is on, the
 * glyph renders static rather than animating, matching the rest of
 * the Training Facility's motion-respect pattern.
 *
 * Client-only because Framer Motion's `useReducedMotion` reads from
 * the browser's media-query state. Mounted as a client leaf inside
 * the otherwise server-rendered SVG so the rest of the gym scene
 * stays SSR-able without hydration cost.
 */
export function PulsingHeart({ bpm }: PulsingHeartProps): JSX.Element {
  const reduceMotion = useReducedMotion()
  // Guard against zero / non-finite BPM (would divide-by-zero into
  // Infinity duration). Falls back to a static glyph rather than
  // refusing to render.
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 0
  const cycleSeconds = safeBpm > 0 ? 60 / safeBpm : 0
  const shouldAnimate = !reduceMotion && cycleSeconds > 0
  return (
    <motion.tspan
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      animate={shouldAnimate ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={
        shouldAnimate
          ? {
              duration: cycleSeconds,
              ease: 'easeInOut' as const,
              repeat: Infinity,
            }
          : { duration: 0 }
      }
      aria-hidden="true"
    >
      ♥
    </motion.tspan>
  )
}
