import { useSyncExternalStore } from 'react'

import { isSafari } from './isSafari'

/** The browser never changes during a page's life, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {}
}

/**
 * Whether this is Safari or iOS WebKit, safe to use while rendering.
 *
 * Calling {@link isSafari} directly in render gives `false` on the server and `true`
 * in Safari, which is a hydration mismatch. This reports `false` through hydration,
 * as the server did, and then re-renders with the real answer.
 */
export function useIsSafari(): boolean {
  return useSyncExternalStore(subscribe, isSafari, () => false)
}
