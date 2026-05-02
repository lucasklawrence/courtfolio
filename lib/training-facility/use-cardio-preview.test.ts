import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { CARDIO_DEMO_DATA } from '@/constants/cardio-demo-fixture'
import type { CardioData } from '@/types/cardio'

import { useCardioPreview, useCardioPreviewHref } from './use-cardio-preview'

/**
 * Tests for the empty-state preview hook + helpers (#162). Mocks
 * `next/navigation` so each case can drive the URL state
 * deterministically. Covers all four meaningful intersections of
 * (real-data state × URL param state) plus the per-activity scoping.
 *
 * The cross-context `isPreviewDemoActive` predicate is tested in its
 * own file (`preview-param.test.ts`) — it lives in a non-`'use client'`
 * module so Server Components can import it.
 */

const searchParamsMock = vi.fn<() => URLSearchParams>(() => new URLSearchParams())
const pathnameMock = vi.fn<() => string>(() => '/training-facility/gym/stair')
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
  usePathname: () => pathnameMock(),
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
    { date: '2026-01-01T00:00:00Z', activity: 'stair', duration_seconds: 1200 },
  ],
  resting_hr_trend: [],
  vo2max_trend: [],
}

const stairOnly: CardioData = {
  imported_at: '2026-01-01T00:00:00Z',
  sessions: [
    { date: '2026-01-01T00:00:00Z', activity: 'stair', duration_seconds: 1200 },
    { date: '2026-01-15T00:00:00Z', activity: 'stair', duration_seconds: 1500 },
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

  describe('with requireActivity (per-activity surfaces)', () => {
    it('shows preview when real data exists but has no sessions of the required activity', () => {
      // Real DB has stair sessions, but the user is on the Walking
      // surface — preview should fire because there's nothing to render.
      setPreviewParam('demo')
      const { result } = renderHook(() =>
        useCardioPreview(stairOnly, { requireActivity: 'walking' }),
      )
      expect(result.current.data).toBe(CARDIO_DEMO_DATA)
      expect(result.current.isPreviewMode).toBe(true)
    })

    it('shows the CTA (no preview param) when real data has no sessions of the required activity', () => {
      setPreviewParam(null)
      const { result } = renderHook(() =>
        useCardioPreview(stairOnly, { requireActivity: 'walking' }),
      )
      expect(result.current.data).toBe(stairOnly)
      expect(result.current.showEmptyStateCta).toBe(true)
      expect(result.current.isPreviewMode).toBe(false)
    })

    it('passes through real data when the required activity has sessions', () => {
      setPreviewParam('demo')
      const { result } = renderHook(() =>
        useCardioPreview(stairOnly, { requireActivity: 'stair' }),
      )
      expect(result.current.data).toBe(stairOnly)
      expect(result.current.isPreviewMode).toBe(false)
      expect(result.current.showEmptyStateCta).toBe(false)
    })
  })
})

describe('useCardioPreviewHref', () => {
  it('appends the preview param to the current pathname', () => {
    pathnameMock.mockReturnValue('/training-facility/gym/treadmill')
    const { result } = renderHook(() => useCardioPreviewHref())
    expect(result.current).toBe('/training-facility/gym/treadmill?preview=demo')
  })

  it('handles a different route so a future move follows along', () => {
    pathnameMock.mockReturnValue('/tf/gym/stair')
    const { result } = renderHook(() => useCardioPreviewHref())
    expect(result.current).toBe('/tf/gym/stair?preview=demo')
  })
})
