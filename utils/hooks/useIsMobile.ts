import { useMemo } from 'react'

/**
 * Returns true if user is on a mobile device (phone or tablet).
 */
export function useIsMobile(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  }, [])
}
