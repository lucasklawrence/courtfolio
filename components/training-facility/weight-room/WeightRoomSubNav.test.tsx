import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { WeightRoomSubNav } from './WeightRoomSubNav'

const mockUseAdminSession = vi.fn()

vi.mock('@/lib/auth/use-admin-session', () => ({
  useAdminSession: () => mockUseAdminSession(),
}))

afterEach(() => {
  mockUseAdminSession.mockReset()
})

describe('WeightRoomSubNav — non-admin viewer', () => {
  beforeEach(() => {
    mockUseAdminSession.mockReturnValue({ isAdmin: false, isLoading: false, email: null })
  })

  it('renders only the public Today + History pills', () => {
    const { getByRole, queryByRole } = render(<WeightRoomSubNav active="today" />)
    expect(getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(queryByRole('link', { name: 'Log' })).not.toBeInTheDocument()
  })

  it.each([
    ['today', '/training-facility/weight-room'],
    ['history', '/training-facility/weight-room/history'],
  ] as const)('routes the %s pill to %s', (label, href) => {
    const labelText = label.charAt(0).toUpperCase() + label.slice(1)
    const { getByRole } = render(<WeightRoomSubNav active="today" />)
    expect(getByRole('link', { name: labelText })).toHaveAttribute('href', href)
  })

  it('marks the history pill as the current page when active', () => {
    const { getByRole } = render(<WeightRoomSubNav active="history" />)
    expect(getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
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

describe('WeightRoomSubNav — admin viewer', () => {
  beforeEach(() => {
    mockUseAdminSession.mockReturnValue({
      isAdmin: true,
      isLoading: false,
      email: 'admin@example.com',
    })
  })

  it('renders all four pills (Today / History / Log / Settings)', () => {
    const { getByRole } = render(<WeightRoomSubNav active="today" />)
    expect(getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Log' })).toBeInTheDocument()
    expect(getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it.each([
    ['log', '/training-facility/weight-room/log'],
    ['settings', '/training-facility/weight-room/settings'],
  ] as const)('routes the %s pill to %s', (label, href) => {
    const labelText = label.charAt(0).toUpperCase() + label.slice(1)
    const { getByRole } = render(<WeightRoomSubNav active="today" />)
    expect(getByRole('link', { name: labelText })).toHaveAttribute('href', href)
  })

  it.each([
    ['today', 'Today'],
    ['history', 'History'],
    ['log', 'Log'],
    ['settings', 'Settings'],
  ] as const)('marks the %s pill as the current page when active', (active, label) => {
    const { getByRole } = render(<WeightRoomSubNav active={active} />)
    expect(getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  })
})
