import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { LobbyScene } from './LobbyScene'

/**
 * The corridor lobby is navigation-critical: it is the only way into the
 * three Training Facility sub-areas. These tests pin the three door
 * targets and their accessible names so a geometry refactor can't
 * silently break a route or drop a doorway.
 */
describe('LobbyScene', () => {
  it('exposes the scene with a descriptive accessible name', () => {
    const { getByRole } = render(<LobbyScene />)
    expect(getByRole('img', { name: /training facility lobby/i })).toBeInTheDocument()
  })

  it.each([
    ['Enter The Gym', '/training-facility/gym'],
    ['Enter The Combine', '/training-facility/combine'],
    ['Enter the Weight Room', '/training-facility/weight-room'],
  ])('wires the %s door to %s', (name, href) => {
    const { getByRole } = render(<LobbyScene />)
    expect(getByRole('link', { name })).toHaveAttribute('href', href)
  })

  it('labels each doorway with its destination sign', () => {
    const { getByText } = render(<LobbyScene />)
    expect(getByText('The Gym')).toBeInTheDocument()
    expect(getByText('The Combine')).toBeInTheDocument()
    expect(getByText('Weight Room')).toBeInTheDocument()
  })
})
