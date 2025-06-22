import { useEffect, useState } from 'react'

export function useElementRect(targetId?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null)

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

  return rect
}
