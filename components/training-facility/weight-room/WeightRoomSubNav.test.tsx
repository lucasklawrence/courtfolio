import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { WeightRoomSubNav } from './WeightRoomSubNav'

describe('WeightRoomSubNav', () => {
  it('renders all three section links', () => {
    const { getByRole } = render(<WeightRoomSubNav active="today" />)
    expect(getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it.each([
    ['today', '/training-facility/weight-room'],
    ['history', '/training-facility/weight-room/history'],
    ['settings', '/training-facility/weight-room/settings'],
  ] as const)('routes the %s pill to %s', (label, href) => {
    const labelText = label.charAt(0).toUpperCase() + label.slice(1)
    const { getByRole } = render(<WeightRoomSubNav active="today" />)
    expect(getByRole('link', { name: labelText })).toHaveAttribute('href', href)
  })

  it.each([
    ['today', 'Today'],
    ['history', 'History'],
    ['settings', 'Settings'],
  ] as const)('marks the %s pill as the current page when active', (active, label) => {
    const { getByRole } = render(<WeightRoomSubNav active={active} />)
    expect(getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  })

  it('only one pill is marked aria-current at a time', () => {
    const { container } = render(<WeightRoomSubNav active="history" />)
    const currentLinks = container.querySelectorAll('a[aria-current="page"]')
    expect(currentLinks).toHaveLength(1)
    expect(currentLinks[0].textContent).toBe('History')
  })

  it('passes through className to the outer nav', () => {
    const { getByTestId } = render(<WeightRoomSubNav active="today" className="mt-4" />)
    expect(getByTestId('weight-room-sub-nav').className).toContain('mt-4')
  })
})
