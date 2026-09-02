import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DoorToGym } from './combine-fixtures'

/**
 * Render coverage for `DoorToGym`. The door is the Combine's mirror of the
 * Gym's `DoorToCombine` and provides the missing direction in the PRD §7.4
 * cross-link (slice A of #75). These assertions cover:
 *
 *   1. The wrapping `<Link>` resolves to an `<a>` with the right `href` and
 *      the back-door aria-label so keyboard / screen-reader users can find it.
 *   2. The "→ the gym" overhead sign and the "back door" underfoot caption
 *      both render — those texts are how a sighted user knows where the door
 *      goes without hovering.
 *
 *   3. The door disappears entirely when the Gym is dark (#345) — the two
 *      areas ship on separate flags, so the Combine can be live while the Gym
 *      is not, and a painted, signposted door into a 404 is worse than a blank
 *      wall.
 *
 * Visual fidelity (rough.js seeds, focus-ring opacity, spotlight ellipse) is
 * intentionally not asserted — too fragile, spot-checked on the Vercel
 * preview. The component is rendered inside an `<svg>` parent so the
 * `<rect>` / `<text>` children land in the correct namespace.
 */
describe('DoorToGym', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders a link to /training-facility/gym with the back-door aria-label', () => {
    render(
      <svg>
        <DoorToGym />
      </svg>
    )
    const link = screen.getByRole('link', {
      name: 'Walk through the back door into The Gym',
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/training-facility/gym')
  })

  it('shows the "→ the gym" sign overhead and "back door" underfoot', () => {
    render(
      <svg>
        <DoorToGym />
      </svg>
    )
    expect(screen.getByText('→ the gym')).toBeInTheDocument()
    expect(screen.getByText('back door')).toBeInTheDocument()
  })

  it('renders nothing when the Gym is dark', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', 'false')
    const { container } = render(
      <svg>
        <DoorToGym />
      </svg>
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.querySelector('svg')?.children).toHaveLength(0)
  })
})
