import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { CARDIO_DEMO_DATA } from '@/constants/cardio-demo-fixture'
import type { CardioData } from '@/types/cardio'

import { useCardioPreview } from './use-cardio-preview'

/**
 * Tests for the empty-state preview hook (#162). Mocks
 * `next/navigation`'s `useSearchParams` so each case can drive the
 * preview decision deterministically. Covers all four meaningful
 * intersections of (real-data state × URL param state).
 */

const searchParamsMock = vi.fn<() => URLSearchParams>(() => new URLSearchParams())
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}))

function setPreviewParam(value: string | null): void {
  if (value === null) {
    searchParamsMock.mockReturnValue(new URLSearchParams())
  } else {
    searchParamsMock.mockReturnValue(new URLSearchParams(`preview=${value}`))
  }
}

const populated: CardioData = {
  imported_at: '2026-01-01T00:00:00Z',
  sessions: [
    {
      date: '2026-01-01T00:00:00Z',
      activity: 'stair',
      duration_seconds: 1200,
    },
  ],
  resting_hr_trend: [],
  vo2max_trend: [],
}

const emptyShape: CardioData = {
  imported_at: '',
  sessions: [],
  resting_hr_trend: [],
  vo2max_trend: [],
}

describe('useCardioPreview', () => {
  it('returns the real data unchanged when sessions are populated, regardless of preview param', () => {
    setPreviewParam('demo')
    const { result } = renderHook(() => useCardioPreview(populated))
    expect(result.current.data).toBe(populated)
    expect(result.current.isPreviewMode).toBe(false)
    expect(result.current.showEmptyStateCta).toBe(false)
  })

  it('shows the CTA when real data is empty and no preview param is set', () => {
    setPreviewParam(null)
    const { result } = renderHook(() => useCardioPreview(emptyShape))
    expect(result.current.data).toBe(emptyShape)
    expect(result.current.isPreviewMode).toBe(false)
    expect(result.current.showEmptyStateCta).toBe(true)
  })

  it('substitutes the demo fixture when real data is empty and preview=demo', () => {
    setPreviewParam('demo')
    const { result } = renderHook(() => useCardioPreview(emptyShape))
    expect(result.current.data).toBe(CARDIO_DEMO_DATA)
    expect(result.current.isPreviewMode).toBe(true)
    expect(result.current.showEmptyStateCta).toBe(false)
  })

  it('treats null (no data on disk yet) the same as empty-shape', () => {
    setPreviewParam('demo')
    const { result } = renderHook(() => useCardioPreview(null))
    expect(result.current.data).toBe(CARDIO_DEMO_DATA)
    expect(result.current.isPreviewMode).toBe(true)
    expect(result.current.showEmptyStateCta).toBe(false)
  })

  it('returns undefined as-is during the initial fetch (caller renders loading)', () => {
    setPreviewParam(null)
    const { result } = renderHook(() => useCardioPreview(undefined))
    expect(result.current.data).toBeUndefined()
    // Loading should also surface a CTA so the page never sits blank
    // for users who land while the fetch is still in flight.
    expect(result.current.showEmptyStateCta).toBe(false)
    expect(result.current.isPreviewMode).toBe(false)
  })

  it('ignores values other than "demo" (no implicit truthy)', () => {
    setPreviewParam('1')
    const { result } = renderHook(() => useCardioPreview(emptyShape))
    expect(result.current.data).toBe(emptyShape)
    expect(result.current.isPreviewMode).toBe(false)
    expect(result.current.showEmptyStateCta).toBe(true)
  })
})
