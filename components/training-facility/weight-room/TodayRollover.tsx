'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { PACIFIC_CLOCK } from '@/lib/training-facility/clock'

/** How often an open, visible tab checks whether the Pacific day has turned. */
export const ROLLOVER_CHECK_MS = 60_000

/**
 * How long to wait before asking again when a refresh came back still showing
 * the old day, which happens when the browser's clock runs ahead of the
 * server's across midnight.
 */
export const ROLLOVER_RETRY_MS = 5 * 60_000

/** Props for {@link TodayRollover}. */
export interface TodayRolloverProps {
  /**
   * The Pacific day key (`YYYY-MM-DD`) the server rendered the board for. Once
   * the browser's Pacific day differs, the page is stale.
   */
  renderedDayKey: string
}

/**
 * Keeps an open Today tab on the current day. The board is computed on the
 * server, so without this a tab left open past Pacific midnight keeps showing
 * yesterday's rings and counts as if they were today's.
 *
 * Re-requests the server render (`router.refresh()`) when the tab becomes
 * visible again on a later Pacific day, and checks once a minute while it stays
 * visible, which covers midnight itself. A minute poll rather than a timer aimed
 * at midnight, because a sleeping laptop or a throttled background tab skips
 * timers, and reading the clock on wake is what actually catches up.
 *
 * A successful refresh replaces `renderedDayKey`, which ends the checks for that
 * day. Until it does, further checks wait {@link ROLLOVER_RETRY_MS} before
 * asking again, so a slow refresh isn't stacked on, and a browser clock running
 * ahead of the server's (whose refresh comes back with the old day) still gets
 * the new day a few minutes later instead of never.
 *
 * Renders nothing.
 */
export function TodayRollover({ renderedDayKey }: TodayRolloverProps): null {
  const router = useRouter()
  const lastRequestAt = useRef<number | null>(null)

  useEffect(() => {
    // A new render is a fresh start: whatever was asked for before it landed.
    lastRequestAt.current = null

    function check(): void {
      if (document.visibilityState !== 'visible') return
      if (PACIFIC_CLOCK.today() === renderedDayKey) return
      const now = Date.now()
      if (lastRequestAt.current !== null && now - lastRequestAt.current < ROLLOVER_RETRY_MS) return
      lastRequestAt.current = now
      router.refresh()
    }

    check()
    const interval = window.setInterval(check, ROLLOVER_CHECK_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
    }
  }, [renderedDayKey, router])

  return null
}
