import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { LobbyScene } from './LobbyScene'

/** Both wings lit — the all-doors-open corridor. */
const allLive = { gymLive: true, weightRoomLive: true }

/**
 * The corridor lobby is navigation-critical: it is the only way into the
 * three Training Facility sub-areas. These tests pin the three door
 * targets and their accessible names so a geometry refactor can't
 * silently break a route or drop a doorway — and, since #345, that a dark
 * wing's doorway is inert rather than a link onto a 404.
 */
describe('LobbyScene', () => {
  it('exposes the doors inside a labelled navigation landmark', () => {
    // The scene is the facility's sole navigation, so it's a `navigation`
    // landmark — not role="img", which marks descendants presentational
    // and would drop the three door links from the accessibility tree.
    const { getByRole } = render(<LobbyScene {...allLive} />)
    const nav = getByRole('navigation', { name: /training facility rooms/i })
    expect(nav.tagName.toLowerCase()).toBe('svg')
  })

  it.each([
    ['Enter The Gym', '/training-facility/gym'],
    ['Enter The Combine', '/training-facility/combine'],
    ['Enter the Weight Room', '/training-facility/weight-room'],
  ])('wires the %s door to %s', (name, href) => {
    const { getByRole } = render(<LobbyScene {...allLive} />)
    expect(getByRole('link', { name })).toHaveAttribute('href', href)
  })

  it('labels each doorway with its destination sign', () => {
    const { getByText } = render(<LobbyScene {...allLive} />)
    expect(getByText('The Gym')).toBeInTheDocument()
    expect(getByText('The Combine')).toBeInTheDocument()
    expect(getByText('Weight Room')).toBeInTheDocument()
  })

  it('draws a dark wing as an inert doorway rather than a link', () => {
    const { getByRole, queryByRole } = render(<LobbyScene gymLive={false} weightRoomLive={false} />)

    for (const name of ['Enter The Gym', 'Enter the Weight Room']) {
      expect(queryByRole('link', { name })).not.toBeInTheDocument()
      expect(getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('keeps the Combine reachable — it rides the lobby’s own flag', () => {
    // If the corridor renders at all, NEXT_PUBLIC_ENABLE_TRAINING_FACILITY is
    // on, and that is the same flag the Combine route sits behind.
    const { getByRole } = render(<LobbyScene gymLive={false} weightRoomLive={false} />)
    expect(getByRole('link', { name: 'Enter The Combine' })).toHaveAttribute(
      'href',
      '/training-facility/combine'
    )
  })

  it('still paints all three doorways when both wings are dark', () => {
    // The hall is three doors by design; a dark wing is dimmed, not removed.
    const { getByText, getAllByText } = render(
      <LobbyScene gymLive={false} weightRoomLive={false} />
    )
    expect(getByText('The Gym')).toBeInTheDocument()
    expect(getByText('The Combine')).toBeInTheDocument()
    expect(getByText('Weight Room')).toBeInTheDocument()
    expect(getAllByText('still building')).toHaveLength(2)
  })
})
