'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Props for {@link LazyMount}. */
export interface LazyMountProps {
  /**
   * Content to render once the placeholder scrolls into the viewport.
   * Not rendered (and not fetched) on the initial paint.
   */
  children: ReactNode
  /**
   * `rootMargin` passed to the underlying `IntersectionObserver`. Use to
   * start mounting slightly before the placeholder is on-screen so the
   * content has time to fetch/paint before the user actually reaches it.
   * Defaults to a generous 400px so heavy below-the-fold content has
   * time to settle on slow connections.
   */
  rootMargin?: string
  /**
   * Minimum height reserved by the placeholder, in CSS pixels. Prevents
   * layout shift when the lazy content paints in. Default is 0 — caller
   * should set this if the content has a stable size.
   */
  minHeight?: number
  /**
   * Tailwind class names applied to the placeholder wrapper. Useful for
   * width/aspect-ratio shaping so the reserved space matches the loaded
   * content.
   */
  className?: string
}

/**
 * Defers rendering of `children` until the wrapper scrolls into view (or
 * within `rootMargin` of the viewport). Useful for below-the-fold media
 * — heavy decorative SVGs, scene illustrations, embedded iframes —
 * that would otherwise be fetched eagerly and compete for bandwidth
 * with above-the-fold content.
 *
 * Once mounted, the observer is disconnected and the content stays
 * mounted for the rest of the page lifetime.
 */
export function LazyMount({
  children,
  rootMargin = '400px',
  minHeight = 0,
  className,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      // Old browsers without IO: fall back to immediate mount so the
      // content always renders; the perf optimization is best-effort.
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            return
          }
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div
      ref={ref}
      className={className}
      style={minHeight ? { minHeight } : undefined}
    >
      {visible ? children : null}
    </div>
  )
}
