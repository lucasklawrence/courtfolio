import { useEffect, useState } from 'react'

export function useElementRect(targetId?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Measures a DOM element by id and keeps the rect in sync with resize /
  // orientation changes — a genuine "sync with an external system" effect. The
  // synchronous setRect calls clear/seed the measurement on mount and when the
  // target changes; there's no render-time source for a DOM rect.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional DOM-measurement sync; see comment above */
  useEffect(() => {
    if (!targetId) {
      setRect(null)
      return
    }

    const el = document.getElementById(targetId)
    if (!el) {
      setRect(null)
      return
    }

    const update = () => {
      setRect(el.getBoundingClientRect())
    }

    update()

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [targetId])
  /* eslint-enable react-hooks/set-state-in-effect */

  return rect
}
