import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LobbyBackLink } from './LobbyBackLink'

afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * The regression guarded here is the one that comes free with splitting a
 * feature flag: pages written when a single flag governed every destination
 * still link to the lobby, so publishing the Gym or Weight Room on their own
 * would leave a labelled link straight into a 404 (#345).
 */
describe('LobbyBackLink', () => {
  it('links to the lobby when the lobby is reachable', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', 'true')
    render(<LobbyBackLink />)
    expect(screen.getByRole('link', { name: /training facility/i })).toHaveAttribute(
      'href',
      '/training-facility',
    )
  })

  it('renders nothing when the lobby is dark', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', 'false')
    const { container } = render(<LobbyBackLink />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the flag is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', '')
    const { container } = render(<LobbyBackLink />)
    expect(container).toBeEmptyDOMElement()
  })
})
