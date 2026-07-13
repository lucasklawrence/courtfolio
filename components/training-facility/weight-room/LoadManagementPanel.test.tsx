import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { MovementLoad } from '@/lib/training-facility/load-management'

import { LoadManagementPanel } from './LoadManagementPanel'

/** 28 dummy sparkline points — the panel only reads `volume` for the trend. */
const SPARKLINE: MovementLoad['sparkline'] = Array.from({ length: 28 }, (_, i) => ({
  dayKey: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
  volume: i * 10,
}))

const PUSHUPS_LOAD: MovementLoad = {
  movement: 'pushups',
  color: '#EA580C',
  metric: 'reps',
  unitLabel: 'reps',
  acute7d: 1240,
  prior7d: 1088,
  chronic28d: 4200,
  chronicWeekly: 1050,
  wowPct: 0.14,
  acwr: 1.18,
  flag: 'yellow',
  wowFlag: 'yellow',
  acwrFlag: 'green',
  sparkline: SPARKLINE,
}

describe('LoadManagementPanel', () => {
  it('renders the empty-state copy when loads is empty', () => {
    const { getByTestId } = render(<LoadManagementPanel loads={[]} />)
    expect(getByTestId('load-management-empty')).toBeInTheDocument()
  })

  it('renders one card per movement, tagged with its flag', () => {
    const { getByTestId } = render(
      <LoadManagementPanel
        loads={[PUSHUPS_LOAD, { ...PUSHUPS_LOAD, movement: 'squats', flag: 'red' }]}
      />,
    )
    expect(getByTestId('load-card-pushups')).toHaveAttribute('data-flag', 'yellow')
    expect(getByTestId('load-card-squats')).toHaveAttribute('data-flag', 'red')
  })

  it('shows 7d volume, WoW %, and ACWR for a bodyweight movement', () => {
    const { getByTestId } = render(<LoadManagementPanel loads={[PUSHUPS_LOAD]} />)
    const card = getByTestId('load-card-pushups')
    expect(card.textContent).toContain('1,240')
    expect(card.textContent).toContain('7d rep volume')
    expect(card.textContent).toContain('+14%')
    expect(card.textContent).toContain('1.18')
  })

  it('labels loaded movements with load-volume and pounds', () => {
    const { getByTestId } = render(
      <LoadManagementPanel
        loads={[{ ...PUSHUPS_LOAD, movement: 'shrugs', metric: 'load', unitLabel: 'lb' }]}
      />,
    )
    const card = getByTestId('load-card-shrugs')
    expect(card.textContent).toContain('7d load volume')
    expect(card.textContent).toContain('lb')
  })

  it('renders an em-dash when WoW or ACWR is null', () => {
    const { getByTestId } = render(
      <LoadManagementPanel loads={[{ ...PUSHUPS_LOAD, wowPct: null, acwr: null }]} />,
    )
    expect(getByTestId('load-card-pushups').textContent).toContain('—')
  })

  it('surfaces the flag label for screen readers', () => {
    const { getByTestId } = render(<LoadManagementPanel loads={[PUSHUPS_LOAD]} />)
    const card = getByTestId('load-card-pushups')
    expect(card).toHaveAttribute('aria-label', 'pushups: Caution')
    expect(card.textContent).toContain('Caution')
  })

  it('uses the movement color on the heading', () => {
    const { getByText } = render(<LoadManagementPanel loads={[PUSHUPS_LOAD]} />)
    const heading = getByText('pushups')
    const styleAttr = heading.getAttribute('style') ?? ''
    expect(styleAttr).toMatch(/#EA580C|rgb\(\s*234,\s*88,\s*12\s*\)/i)
  })
})
