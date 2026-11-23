import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

import { ROLLOVER_CHECK_MS, TodayRollover } from './TodayRollover'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}))

/** 11:59 pm Pacific on 1 Aug 2026 (PDT, UTC-7). */
const BEFORE_MIDNIGHT = new Date('2026-08-01T23:59:00-07:00')

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BEFORE_MIDNIGHT)
  refreshMock.mockReset()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TodayRollover', () => {
  it('does nothing while the Pacific day has not turned', () => {
    render(<TodayRollover renderedDayKey="2026-08-01" />)
    act(() => {
      vi.advanceTimersByTime(ROLLOVER_CHECK_MS - 1)
    })
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('refreshes once when a visible tab crosses Pacific midnight', () => {
    render(<TodayRollover renderedDayKey="2026-08-01" />)
    act(() => {
      vi.advanceTimersByTime(ROLLOVER_CHECK_MS)
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)

    // Further checks on the same stale day don't pile up refreshes while the
    // first one is still on its way.
    act(() => {
      vi.advanceTimersByTime(ROLLOVER_CHECK_MS * 5)
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('waits for a hidden tab to be shown, then refreshes', () => {
    visibility = 'hidden'
    render(<TodayRollover renderedDayKey="2026-08-01" />)
    act(() => {
      vi.advanceTimersByTime(ROLLOVER_CHECK_MS * 10)
    })
    expect(refreshMock).not.toHaveBeenCalled()

    act(() => {
      setVisibility('visible')
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes on mount when the server rendered an earlier day', () => {
    render(<TodayRollover renderedDayKey="2026-07-31" />)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
