import { useSyncExternalStore } from 'react'

const MOBILE_QUERY = '(max-width: 900px), (pointer: coarse)'

/**
 * Subscribe to changes in the mobile media query.
 *
 * @param callback - invoked whenever the match state flips
 * @returns an unsubscribe function; a no-op when `matchMedia` is unavailable (SSR)
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
    return () => {}
  }
  const mql = window.matchMedia(MOBILE_QUERY)
  if (mql.addEventListener) {
    mql.addEventListener('change', callback)
    return () => mql.removeEventListener('change', callback)
  }
  // Legacy Safari (<14) fallback — `addEventListener` on MediaQueryList is unsupported there.
  mql.addListener(callback)
  return () => mql.removeListener(callback)
}

/** Client snapshot: true when the viewport/device matches the mobile query. */
function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

/** Server snapshot: assume desktop during SSR, since no viewport is available. */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Returns true if the viewport/device is mobile based on media queries (width/pointer), not UA sniffing.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
