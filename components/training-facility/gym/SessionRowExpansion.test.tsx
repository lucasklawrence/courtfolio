import { describe, expect, it } from 'vitest'
import { act, render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { CardioSession, HrZone } from '@/types/cardio'
import {
  ExpandedHrZoneRow,
  getRowExpansionProps,
  hasZoneData,
  useSessionRowExpansion,
} from './SessionRowExpansion'

/**
 * Build a zones-in-seconds map with sane defaults; pass overrides for the
 * cases the test cares about. Mirrors the helper in `SessionZoneStrip.test`.
 */
const zones = (overrides: Partial<Record<HrZone, number>> = {}): Record<HrZone, number> => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  ...overrides,
})

/** Minimal `CardioSession` fixture — we only care about zone data + identity here. */
const session = (overrides: Partial<CardioSession> = {}): CardioSession => ({
  date: '2026-04-30',
  activity: 'stair',
  duration_seconds: 1800,
  distance_meters: 0,
  pace_seconds_per_km: undefined,
  avg_hr: 142,
  max_hr: 168,
  hr_seconds_in_zone: zones({ 2: 600, 3: 900, 4: 300 }),
  ...overrides,
})

describe('hasZoneData', () => {
  it('returns false when the field is missing', () => {
    expect(hasZoneData(undefined)).toBe(false)
  })
  it('returns false when every zone is zero', () => {
    expect(hasZoneData(zones())).toBe(false)
  })
  it('returns true when at least one zone has logged seconds', () => {
    expect(hasZoneData(zones({ 3: 60 }))).toBe(true)
  })
})

describe('useSessionRowExpansion', () => {
  it('starts with no row expanded', () => {
    const { result } = renderHook(() => useSessionRowExpansion())
    expect(result.current.expandedKey).toBeNull()
  })

  it('toggle opens the row, repeating the same key closes it', () => {
    const { result } = renderHook(() => useSessionRowExpansion())
    act(() => result.current.toggle('row-a'))
    expect(result.current.expandedKey).toBe('row-a')
    act(() => result.current.toggle('row-a'))
    expect(result.current.expandedKey).toBeNull()
  })

  it('opening a different row replaces the previously open row', () => {
    const { result } = renderHook(() => useSessionRowExpansion())
    act(() => result.current.toggle('row-a'))
    act(() => result.current.toggle('row-b'))
    expect(result.current.expandedKey).toBe('row-b')
  })
})

describe('getRowExpansionProps', () => {
  const baseClassName = 'rounded-md bg-white/5'

  it('returns inert props when the session has no zone data', () => {
    const { result } = renderHook(() => useSessionRowExpansion())
    const props = getRowExpansionProps('row-a', result.current, false, baseClassName)
    expect(props.role).toBeUndefined()
    expect(props.tabIndex).toBeUndefined()
    expect(props['aria-expanded']).toBeUndefined()
    expect(props.onClick).toBeUndefined()
    expect(props.onKeyDown).toBeUndefined()
    expect(props.className).toBe(baseClassName)
  })

  it('marks the row interactive when zone data is present', () => {
    const { result } = renderHook(() => useSessionRowExpansion())
    const props = getRowExpansionProps('row-a', result.current, true, baseClassName)
    expect(props.role).toBe('button')
    expect(props.tabIndex).toBe(0)
    expect(props['aria-expanded']).toBe(false)
    expect(props.className).toContain(baseClassName)
    expect(props.className).toContain('cursor-pointer')
  })

  it('reflects expanded state when keys match', () => {
    const { result } = renderHook(() => useSessionRowExpansion())
    act(() => result.current.toggle('row-a'))
    const props = getRowExpansionProps('row-a', result.current, true, baseClassName)
    expect(props['aria-expanded']).toBe(true)
  })
})

describe('row interaction (click + keyboard)', () => {
  /**
   * Tiny harness that mounts a 2-row table using the helper. Lets us assert
   * the click/keyboard flow without standing up the full `AllCardioOverview`
   * (which would require mocking `getCardioData`, `MaxHrControl` storage,
   * `ResizeObserver`, etc.).
   */
  function Harness() {
    const state = useSessionRowExpansion()
    const rows = [
      { key: 'row-a', hasZones: true },
      { key: 'row-b', hasZones: true },
      { key: 'row-c', hasZones: false },
    ]
    return (
      <table>
        <tbody>
          {rows.map((r) => {
            const props = getRowExpansionProps(r.key, state, r.hasZones, '')
            return (
              <tr key={r.key} data-testid={r.key} {...props}>
                <td>{r.key}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  it('click toggles the row open and closed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const rowA = screen.getByTestId('row-a')
    expect(rowA).toHaveAttribute('aria-expanded', 'false')
    await user.click(rowA)
    expect(rowA).toHaveAttribute('aria-expanded', 'true')
    await user.click(rowA)
    expect(rowA).toHaveAttribute('aria-expanded', 'false')
  })

  it('opening a second row collapses the first', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const rowA = screen.getByTestId('row-a')
    const rowB = screen.getByTestId('row-b')
    await user.click(rowA)
    expect(rowA).toHaveAttribute('aria-expanded', 'true')
    await user.click(rowB)
    expect(rowA).toHaveAttribute('aria-expanded', 'false')
    expect(rowB).toHaveAttribute('aria-expanded', 'true')
  })

  it('Enter and Space toggle expansion via keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const rowA = screen.getByTestId('row-a')
    rowA.focus()
    await user.keyboard('{Enter}')
    expect(rowA).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard(' ')
    expect(rowA).toHaveAttribute('aria-expanded', 'false')
  })

  it('rows without zone data have no interactive affordance', () => {
    render(<Harness />)
    const rowC = screen.getByTestId('row-c')
    expect(rowC).not.toHaveAttribute('role', 'button')
    expect(rowC).not.toHaveAttribute('tabindex')
    expect(rowC).not.toHaveAttribute('aria-expanded')
  })
})

describe('ExpandedHrZoneRow', () => {
  it('renders an HrZoneBars labelled with the time-in-zone aria text', () => {
    render(
      <table>
        <tbody>
          <ExpandedHrZoneRow session={session()} colSpan={5} fontFamily="sans-serif" />
        </tbody>
      </table>,
    )
    // HrZoneBars renders as an SVG with role="img" and an explicit aria-label
    // — the strongest signal that the chart hydrated for this single session.
    expect(screen.getByRole('img', { name: /time in heart-rate zone/i })).toBeInTheDocument()
    expect(screen.getByTestId('session-row-expansion')).toBeInTheDocument()
  })

  it('renders the empty-chart fallback when zone data is all zeros', () => {
    const empty = session({ hr_seconds_in_zone: zones() })
    render(
      <table>
        <tbody>
          <ExpandedHrZoneRow session={empty} colSpan={5} />
        </tbody>
      </table>,
    )
    // Empty-state: HrZoneBars renders an `EmptyChart` with the default message.
    expect(screen.getByText(/no hr-zone data/i)).toBeInTheDocument()
  })

  it('uses the provided colSpan on the cell', () => {
    render(
      <table>
        <tbody>
          <ExpandedHrZoneRow session={session()} colSpan={8} />
        </tbody>
      </table>,
    )
    const cell = screen.getByTestId('session-row-expansion').querySelector('td')
    expect(cell).toHaveAttribute('colspan', '8')
  })
})

