'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { JSX } from 'react'

/** Props for {@link PulsingHeart}. */
export interface PulsingHeartProps {
  /** SVG x position of the glyph (passed straight through to `<text>`). */
  x: number
  /** SVG y position of the glyph (passed straight through to `<text>`). */
  y: number
  /** Fill color for the glyph. */
  fill: string
  /** Beats per minute that drives the cycle duration — `60_000 / bpm` ms per pulse so the visible beat matches the displayed number. */
  bpm: number
  /** Font family for the heart glyph; should match the surrounding fixture. */
  fontFamily: string
  /** Font size of the glyph in SVG units. */
  fontSize: number
}

/**
 * Animated heart glyph (♥) that scales between 1.0 and 1.15 at the
 * cycle rate of `60_000 / bpm` ms — so a displayed 60 BPM beats once
 * per second, 90 BPM beats 1.5×/s, etc. Visibly tying the animation
 * frequency to the value is the point of PRD §7.4's pulse note.
 *
 * Honors `prefers-reduced-motion`: when the OS toggle is on, the glyph
 * renders static rather than animating, matching the rest of the
 * Training Facility's motion-respect pattern.
 *
 * Client-only because Framer Motion's `useReducedMotion` reads from
 * the browser's media-query state. Mounted as a client leaf inside
 * the otherwise server-rendered SVG so the rest of the gym scene stays
 * SSR-able without hydration cost.
 */
export function PulsingHeart({
  x,
  y,
  fill,
  bpm,
  fontFamily,
  fontSize,
}: PulsingHeartProps): JSX.Element {
  const reduceMotion = useReducedMotion()
  // Guard against zero / non-finite BPM (would divide-by-zero into
  // Infinity duration). Falls back to a static glyph rather than
  // refusing to render.
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 0
  const cycleSeconds = safeBpm > 0 ? 60 / safeBpm : 0
  const animate =
    !reduceMotion && cycleSeconds > 0
      ? { scale: [1, 1.15, 1] }
      : { scale: 1 }
  const transition =
    !reduceMotion && cycleSeconds > 0
      ? {
          duration: cycleSeconds,
          ease: 'easeInOut' as const,
          repeat: Infinity,
        }
      : { duration: 0 }
  return (
    <motion.text
      x={x}
      y={y}
      fill={fill}
      fontFamily={fontFamily}
      fontSize={fontSize}
      // SVG transforms scale around the origin (0,0); transformOrigin
      // keeps the heart pulsing in place rather than drifting.
      style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'fill-box' }}
      animate={animate}
      transition={transition}
      aria-hidden="true"
    >
      ♥
    </motion.text>
  )
}
