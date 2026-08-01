import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { FacilityBackLink } from './FacilityBackLink'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Turn on only the flags named; everything else stays off. */
function withFlags({
  gym = false,
  weightRoom = false,
  lobby = false,
}: {
  gym?: boolean
  weightRoom?: boolean
  lobby?: boolean
}) {
  vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', gym ? 'true' : 'false')
  vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM', weightRoom ? 'true' : 'false')
  vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', lobby ? 'true' : 'false')
}

/**
 * The regression that comes free with splitting a feature flag: pages written
 * when one flag governed every destination still link "up", and either parent
 * can now be dark (#345).
 */
describe('FacilityBackLink', () => {
  it('prefers the tracking hub when an area is live', () => {
    withFlags({ weightRoom: true, lobby: true })
    render(<FacilityBackLink />)
    expect(screen.getByRole('link', { name: /tracking/i })).toHaveAttribute(
      'href',
      '/training-facility/tracking'
    )
  })

  it('uses the hub even with the lobby dark — the hub only needs one area', () => {
    withFlags({ gym: true, lobby: false })
    render(<FacilityBackLink />)
    expect(screen.getByRole('link', { name: /tracking/i })).toHaveAttribute(
      'href',
      '/training-facility/tracking'
    )
  })

  it('falls back to the lobby when no area is live but the lobby is', () => {
    withFlags({ lobby: true })
    render(<FacilityBackLink />)
    expect(screen.getByRole('link', { name: /training facility/i })).toHaveAttribute(
      'href',
      '/training-facility'
    )
  })

  it('renders nothing when neither parent is reachable', () => {
    withFlags({})
    const { container } = render(<FacilityBackLink />)
    expect(container).toBeEmptyDOMElement()
  })
})
