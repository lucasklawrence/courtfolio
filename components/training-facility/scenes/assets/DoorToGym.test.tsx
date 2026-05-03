import { describe, it, expect } from 'vitest'
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
 * Visual fidelity (rough.js seeds, focus-ring opacity, spotlight ellipse) is
 * intentionally not asserted — too fragile, spot-checked on the Vercel
 * preview. The component is rendered inside an `<svg>` parent so the
 * `<rect>` / `<text>` children land in the correct namespace.
 */
describe('DoorToGym', () => {
  it('renders a link to /training-facility/gym with the back-door aria-label', () => {
    render(
      <svg>
        <DoorToGym />
      </svg>,
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
      </svg>,
    )
    expect(screen.getByText('→ the gym')).toBeInTheDocument()
    expect(screen.getByText('back door')).toBeInTheDocument()
  })
})
