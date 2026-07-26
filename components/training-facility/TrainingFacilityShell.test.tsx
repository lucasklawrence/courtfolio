import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TrainingFacilityShell } from './TrainingFacilityShell'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Turn on only the flags named; everything else stays off. */
function withFlags({ gym = false, weightRoom = false }: { gym?: boolean; weightRoom?: boolean }) {
  vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', gym ? 'true' : 'false')
  vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM', weightRoom ? 'true' : 'false')
}

/**
 * The lobby says "Pick a door.", so every door it offers has to open. Since
 * #345 each wing ships on its own flag, which means a door can point at a route
 * that 404s — these pin that a dark wing is inert rather than a dead link.
 */
describe('TrainingFacilityShell doors', () => {
  it('links both wings when they are live', () => {
    withFlags({ gym: true, weightRoom: true })
    render(<TrainingFacilityShell />)
    expect(screen.getByRole('link', { name: /the gym/i })).toHaveAttribute(
      'href',
      '/training-facility/gym',
    )
    expect(screen.getByRole('link', { name: /weight room/i })).toHaveAttribute(
      'href',
      '/training-facility/weight-room',
    )
  })

  it('renders a dark wing as an inert door, not a link', () => {
    withFlags({ gym: false, weightRoom: true })
    render(<TrainingFacilityShell />)
    expect(screen.queryByRole('link', { name: /the gym/i })).not.toBeInTheDocument()
    const gym = screen.getByRole('button', { name: /the gym/i })
    expect(gym).toBeDisabled()
    expect(gym).toHaveAttribute('aria-disabled', 'true')
    // The live wing is unaffected — the flags are independent.
    expect(screen.getByRole('link', { name: /weight room/i })).toBeInTheDocument()
  })

  it('keeps the door visible so the room still reads as three wings', () => {
    withFlags({ gym: false, weightRoom: false })
    render(<TrainingFacilityShell />)
    expect(screen.getByRole('button', { name: /the gym/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /weight room/i })).toBeInTheDocument()
    // The Combine shares the lobby's own flag, so if the lobby renders at all
    // the Combine is reachable.
    expect(screen.getByRole('link', { name: /the combine/i })).toHaveAttribute(
      'href',
      '/training-facility/combine',
    )
  })

  it('says which wings are still being built', () => {
    withFlags({ gym: false, weightRoom: true })
    render(<TrainingFacilityShell />)
    expect(screen.getByText('Still building')).toBeInTheDocument()
    expect(screen.getAllByText('Route live now').length).toBe(2)
  })
})
