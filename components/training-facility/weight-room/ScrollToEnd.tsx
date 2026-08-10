'use client'

import { useEffect, useRef, type JSX, type ReactNode } from 'react'

/** Props for {@link ScrollToEnd}. */
export interface ScrollToEndProps {
  /** Content to scroll; usually a chart wider than the container. */
  children: ReactNode
  /**
   * Whether to jump to the right edge. `false` leaves the container at its
   * natural left-aligned start, which is correct whenever the content fits.
   */
  enabled: boolean
  /** Classes for the scroll container itself. */
  className?: string
  /** Accessible label, since a scrollable region is focusable. */
  label?: string
}

/**
 * A horizontal scroller that opens at its **right** edge (#438).
 *
 * The all-time heatmap is ~1,400px inside a ~900px column, and a scroller
 * starts at `scrollLeft: 0` — so switching to All time landed every chart on
 * 2022 with the current week off the right edge. For a movement whose archive
 * is sparse (squats has a single 2022 cell) that opens on a blank grid, which
 * reads as "the all-time view is broken" — the very misperception the range was
 * added to correct.
 *
 * Anchoring right keeps the invariant the trailing-year view had for free:
 * today is always on screen, and the history extends back to the left.
 *
 * Client-only, and deliberately the *only* client code in this feature — the
 * range itself resolves on the server. Without JS the container simply stays
 * left-aligned and scrollable by hand, which is the pre-existing behavior
 * rather than a broken one.
 */
export function ScrollToEnd({
  children,
  enabled,
  className,
  label,
}: ScrollToEndProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el === null || !enabled) return
    // Jump, not smooth-scroll: this is the initial position, and animating it
    // would read as the page drifting on load.
    el.scrollLeft = el.scrollWidth
  }, [enabled])

  return (
    <div
      ref={ref}
      className={className}
      // A scrollable region needs to be reachable and named for keyboard and
      // screen-reader users; without JS it is still both.
      tabIndex={enabled ? 0 : undefined}
      role={enabled ? 'region' : undefined}
      aria-label={enabled ? label : undefined}
    >
      {children}
    </div>
  )
}
