'use client'

import { useEffect, useMemo, useState } from 'react'

import { buildTodayBoard, type TodayBoardRow } from '@/lib/training-facility/today-board'
import type { WeightRoomData } from '@/types/weight-room'

/**
 * Today's board for a client surface. The clock is read after mount so the
 * server render and the first client render match; both see no clock and show
 * permanent goals at zero, then the real totals and any active focus fill in.
 *
 * @param data The Weight Room dataset; `null` while nothing has loaded.
 */
export function useTodayBoard(data: WeightRoomData | null | undefined): TodayBoardRow[] {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: the clock must be read post-mount (see comment above) to keep SSR and first client render identical
    setNow(new Date())
  }, [])

  return useMemo(() => buildTodayBoard(data, now), [data, now])
}
