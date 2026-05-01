/**
 * Tests for {@link useMaxHr} and the standalone {@link parseMaxHr} validator.
 *
 * The hook is the single source of runtime max HR for the Training Load
 * chart, so coverage targets the things a real user would hit:
 *   - default behavior with empty / corrupt storage,
 *   - round-trip persistence,
 *   - clamping invalid input on `setMaxHr`,
 *   - SSR-safety via the `ready` flag,
 *   - graceful fallback when `localStorage` throws.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAX_HR } from '@/constants/hr-zones'

import {
  MAX_HR_STORAGE_KEY,
  MAX_MAX_HR,
  MIN_MAX_HR,
  parseMaxHr,
  useMaxHr,
} from './useMaxHr'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseMaxHr', () => {
  it('accepts valid integers in range', () => {
    expect(parseMaxHr(185)).toBe(185)
    expect(parseMaxHr(MIN_MAX_HR)).toBe(MIN_MAX_HR)
    expect(parseMaxHr(MAX_MAX_HR)).toBe(MAX_MAX_HR)
  })

  it('rounds non-integer numbers', () => {
    expect(parseMaxHr(184.6)).toBe(185)
    expect(parseMaxHr(184.4)).toBe(184)
  })

  it('parses string numbers', () => {
    expect(parseMaxHr('190')).toBe(190)
    expect(parseMaxHr(' 175 ')).toBe(175)
  })

  it('rejects out-of-range values', () => {
    expect(parseMaxHr(MIN_MAX_HR - 1)).toBeNull()
    expect(parseMaxHr(MAX_MAX_HR + 1)).toBeNull()
    expect(parseMaxHr(0)).toBeNull()
    expect(parseMaxHr(-185)).toBeNull()
  })

  it('rejects non-numeric / missing input', () => {
    expect(parseMaxHr(null)).toBeNull()
    expect(parseMaxHr(undefined)).toBeNull()
    expect(parseMaxHr('')).toBeNull()
    expect(parseMaxHr('abc')).toBeNull()
    expect(parseMaxHr(Number.NaN)).toBeNull()
    expect(parseMaxHr(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('useMaxHr', () => {
  it('returns DEFAULT_MAX_HR when storage is empty', async () => {
    const { result } = renderHook(() => useMaxHr())
    // Effect runs after the first commit — assert post-effect state.
    await vi.waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.maxHr).toBe(DEFAULT_MAX_HR)
    expect(result.current.isUserSet).toBe(false)
  })

  it('reads a previously persisted value on mount', async () => {
    localStorage.setItem(MAX_HR_STORAGE_KEY, '198')
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.maxHr).toBe(198)
    expect(result.current.isUserSet).toBe(true)
  })

  it('falls back to default when storage holds a corrupt value', async () => {
    localStorage.setItem(MAX_HR_STORAGE_KEY, 'not-a-number')
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.maxHr).toBe(DEFAULT_MAX_HR)
    expect(result.current.isUserSet).toBe(false)
  })

  it('falls back to default when storage holds an out-of-range value', async () => {
    localStorage.setItem(MAX_HR_STORAGE_KEY, '999')
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.maxHr).toBe(DEFAULT_MAX_HR)
    expect(result.current.isUserSet).toBe(false)
  })

  it('persists a valid setMaxHr call', async () => {
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))

    let saved = false
    act(() => {
      saved = result.current.setMaxHr(192)
    })
    expect(saved).toBe(true)
    expect(result.current.maxHr).toBe(192)
    expect(result.current.isUserSet).toBe(true)
    expect(localStorage.getItem(MAX_HR_STORAGE_KEY)).toBe('192')
  })

  it('rejects invalid setMaxHr without changing state or storage', async () => {
    localStorage.setItem(MAX_HR_STORAGE_KEY, '180')
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))

    let saved = true
    act(() => {
      saved = result.current.setMaxHr(MAX_MAX_HR + 5)
    })
    expect(saved).toBe(false)
    expect(result.current.maxHr).toBe(180)
    expect(result.current.isUserSet).toBe(true)
    expect(localStorage.getItem(MAX_HR_STORAGE_KEY)).toBe('180')
  })

  it('reset() clears storage and reverts to default', async () => {
    localStorage.setItem(MAX_HR_STORAGE_KEY, '200')
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))

    act(() => {
      result.current.reset()
    })
    expect(result.current.maxHr).toBe(DEFAULT_MAX_HR)
    expect(result.current.isUserSet).toBe(false)
    expect(localStorage.getItem(MAX_HR_STORAGE_KEY)).toBeNull()
  })

  it('survives a localStorage.getItem that throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.maxHr).toBe(DEFAULT_MAX_HR)
    expect(result.current.isUserSet).toBe(false)
    spy.mockRestore()
  })

  it('survives a localStorage.setItem that throws (in-memory still updates)', async () => {
    const { result } = renderHook(() => useMaxHr())
    await vi.waitFor(() => expect(result.current.ready).toBe(true))

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    let saved = false
    act(() => {
      saved = result.current.setMaxHr(195)
    })
    expect(saved).toBe(true)
    expect(result.current.maxHr).toBe(195)
    expect(result.current.isUserSet).toBe(true)
    spy.mockRestore()
  })
})
