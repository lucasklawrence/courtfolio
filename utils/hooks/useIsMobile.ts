import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 900px), (pointer: coarse)'

const evaluateIsMobile = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return false
  return window.matchMedia(MOBILE_QUERY).matches
}

/**
 * Returns true if the viewport/device is mobile based on media queries (width/pointer), not UA sniffing.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => evaluateIsMobile())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return
    const mql = window.matchMedia(MOBILE_QUERY)
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mql.matches)
    mql.addEventListener
      ? mql.addEventListener('change', handleChange)
      : mql.addListener(handleChange)

    return () => {
      mql.removeEventListener
        ? mql.removeEventListener('change', handleChange)
        : mql.removeListener(handleChange)
    }
  }, [])

  return isMobile
}
