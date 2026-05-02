import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { HR_ZONES } from '@/constants/hr-zones'
import type { HrZone } from '@/types/cardio'
import { SessionZoneStrip } from './SessionZoneStrip'

/**
 * Build a zones-in-seconds map with sane defaults; pass overrides for the
 * cases the test cares about.
 */
const zones = (overrides: Partial<Record<HrZone, number>> = {}): Record<HrZone, number> => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  ...overrides,
})

describe('SessionZoneStrip', () => {
  it('renders a segment per non-zero zone with proportional widths and a tooltip', () => {
    render(
      <SessionZoneStrip
        hrSecondsInZone={zones({ 2: 480, 3: 720, 4: 600 })}
      />,
    )
    const strip = screen.getByRole('img')
    // Tooltip text covers all five zones, in canonical order, with both Mm Ss
    // and bare Ss for the sub-minute case.
    expect(strip).toHaveAccessibleName('Z1: 0s, Z2: 8m 00s, Z3: 12m 00s, Z4: 10m 00s, Z5: 0s')
    expect(strip).toHaveAttribute('title', expect.stringContaining('Z3: 12m 00s'))
    // Zero zones don't render a segment, so we get exactly three.
    const z2 = screen.getByTestId('zone-segment-Z2')
    const z3 = screen.getByTestId('zone-segment-Z3')
    const z4 = screen.getByTestId('zone-segment-Z4')
    expect(screen.queryByTestId('zone-segment-Z1')).toBeNull()
    expect(screen.queryByTestId('zone-segment-Z5')).toBeNull()
    // Widths are seconds / total — 1800s total, so Z2 = 480/1800 ≈ 26.67%.
    expect(z2.style.width).toMatch(/^26\.6\d+%$/)
    expect(z3.style.width).toBe('40%')
    expect(z4.style.width).toMatch(/^33\.3\d+%$/)
    // Colors come from the canonical palette.
    expect(z3.style.backgroundColor).toBe(hexToRgb(HR_ZONES[2]!.color))
  })

  it('renders the em-dash fallback when hrSecondsInZone is undefined', () => {
    render(<SessionZoneStrip />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByLabelText('No zone data')).toHaveTextContent('—')
  })

  it('renders the em-dash fallback when every zone is zero', () => {
    render(<SessionZoneStrip hrSecondsInZone={zones()} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByLabelText('No zone data')).toHaveTextContent('—')
  })

  it('renders a single full-width segment when all time is in one zone', () => {
    render(<SessionZoneStrip hrSecondsInZone={zones({ 3: 1200 })} />)
    const z3 = screen.getByTestId('zone-segment-Z3')
    expect(z3.style.width).toBe('100%')
    // No other segments render — verify by checking the render count.
    for (const id of ['Z1', 'Z2', 'Z4', 'Z5']) {
      expect(screen.queryByTestId(`zone-segment-${id}`)).toBeNull()
    }
  })
})

/**
 * Convert a `#rrggbb` hex to the `rgb(r, g, b)` form jsdom serializes
 * inline `style.backgroundColor` as. Lets the assertion above stay
 * symbolic against `HR_ZONES` rather than hard-coding the hex.
 */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}
