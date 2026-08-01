import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { WeightRoomSubNav } from './WeightRoomSubNav'

/**
 * Admin status is a prop rather than a hook (#345), so these tests pass it
 * directly — no `use-admin-session` mock, and nothing here pulls in a browser
 * Supabase client. That absence is the point: this nav renders on three
 * publicly reachable pages, and a client-side Supabase import would inline the
 * anon key into their bundles.
 */
describe('WeightRoomSubNav — non-admin viewer', () => {
  it('renders only the public Today + History + Trophies pills', () => {
    const { getByRole, queryByRole } = render(<WeightRoomSubNav active="today" isAdmin={false} />)
    expect(getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Trophies' })).toBeInTheDocument()
    expect(queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(queryByRole('link', { name: 'Log' })).not.toBeInTheDocument()
  })

  it.each([
    ['Today', '/training-facility/weight-room'],
    ['History', '/training-facility/weight-room/history'],
    ['Trophies', '/training-facility/weight-room/achievements'],
  ] as const)('routes the %s pill to %s', (labelText, href) => {
    const { getByRole } = render(<WeightRoomSubNav active="today" isAdmin={false} />)
    expect(getByRole('link', { name: labelText })).toHaveAttribute('href', href)
  })

  it('marks the history pill as the current page when active', () => {
    const { getByRole } = render(<WeightRoomSubNav active="history" isAdmin={false} />)
    expect(getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks the trophies pill as the current page when active', () => {
    const { getByRole } = render(<WeightRoomSubNav active="achievements" isAdmin={false} />)
    expect(getByRole('link', { name: 'Trophies' })).toHaveAttribute('aria-current', 'page')
  })

  it('only one pill is marked aria-current at a time', () => {
    const { container } = render(<WeightRoomSubNav active="history" isAdmin={false} />)
    const currentLinks = container.querySelectorAll('a[aria-current="page"]')
    expect(currentLinks).toHaveLength(1)
    expect(currentLinks[0].textContent).toBe('History')
  })

  it('passes through className to the outer nav', () => {
    const { getByTestId } = render(
      <WeightRoomSubNav active="today" className="mt-4" isAdmin={false} />
    )
    expect(getByTestId('weight-room-sub-nav').className).toContain('mt-4')
  })
})

describe('WeightRoomSubNav — admin viewer', () => {
  it('renders all five pills (Today / History / Trophies / Log / Settings)', () => {
    const { getByRole } = render(<WeightRoomSubNav active="today" isAdmin />)
    expect(getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Trophies' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Log' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it.each([
    ['Log', '/training-facility/weight-room/log'],
    ['Settings', '/training-facility/weight-room/settings'],
  ] as const)('routes the %s pill to %s', (labelText, href) => {
    const { getByRole } = render(<WeightRoomSubNav active="today" isAdmin />)
    expect(getByRole('link', { name: labelText })).toHaveAttribute('href', href)
  })

  it.each([
    ['today', 'Today'],
    ['history', 'History'],
    ['achievements', 'Trophies'],
    ['log', 'Log'],
    ['settings', 'Settings'],
  ] as const)('marks the %s pill as the current page when active', (active, label) => {
    const { getByRole } = render(<WeightRoomSubNav active={active} isAdmin />)
    expect(getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  })
})
