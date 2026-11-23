'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { PACIFIC_CLOCK } from '@/lib/training-facility/clock'

/** How often an open, visible tab checks whether the Pacific day has turned. */
export const ROLLOVER_CHECK_MS = 60_000

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
 * Asks once per stale day: the refresh replaces `renderedDayKey`, and until it
 * lands a second check for the same day does nothing.
 *
 * Renders nothing.
 */
export function TodayRollover({ renderedDayKey }: TodayRolloverProps): null {
  const router = useRouter()
  const requestedFor = useRef<string | null>(null)

  useEffect(() => {
    function check(): void {
      if (document.visibilityState !== 'visible') return
      const today = PACIFIC_CLOCK.today()
      if (today === renderedDayKey || requestedFor.current === today) return
      requestedFor.current = today
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
