import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { CorridorDoor, type DoorCorners } from './CorridorDoor'

/**
 * Coverage for the perspective corridor door. Both the side-wall
 * (foreshortened) and end-of-hall (front-facing) doors flow through this
 * one component, so verifying href + accessible name + sign copy +
 * hover/focus overlays here keeps every LobbyScene call site honest.
 *
 * Rendered inside an `<svg>` because the door is composed of SVG
 * primitives meant to live inside a scene viewBox.
 */
describe('CorridorDoor', () => {
  const CORNERS: DoorCorners = [
    { x: 150, y: 315 },
    { x: 330, y: 333 },
    { x: 330, y: 686 },
    { x: 150, y: 803 },
  ]

  function renderInScene(extra: Partial<React.ComponentProps<typeof CorridorDoor>> = {}) {
    return render(
      <svg viewBox="0 0 1600 900" data-testid="scene">
        <CorridorDoor
          href="/training-facility/combine"
          ariaLabel="Enter The Combine"
          title="The Combine"
          subtitle="movement wing"
          corners={CORNERS}
          label={{ x: 240, y: 250 }}
          {...extra}
        />
      </svg>
    )
  }

  it('renders a Next link pointed at the href with the accessible label', () => {
    const { getByRole } = renderInScene()
    const link = getByRole('link', { name: /enter the combine/i })
    expect(link).toHaveAttribute('href', '/training-facility/combine')
  })

  it('paints the sign title and subtitle', () => {
    const { getByText } = renderInScene()
    expect(getByText('The Combine')).toBeInTheDocument()
    expect(getByText('movement wing')).toBeInTheDocument()
  })

  it('omits the subtitle text when none is supplied', () => {
    const { queryByText } = renderInScene({ subtitle: undefined })
    expect(queryByText('movement wing')).not.toBeInTheDocument()
  })

  it('includes a focus-visible dashed ring overlay, hidden by default', () => {
    const { container } = renderInScene()
    // The focus ring is the only element with a stroke-dasharray.
    const ring = container.querySelector('[stroke-dasharray]')
    expect(ring).not.toBeNull()
    expect(ring).toHaveClass('opacity-0')
    expect(ring?.getAttribute('class')).toContain('group-focus-visible:opacity-100')
  })

  it('renders a translucent hover-tint overlay', () => {
    const { container } = renderInScene()
    const overlay = container.querySelector('polygon.group-hover\\:opacity-10')
    expect(overlay).not.toBeNull()
    expect(overlay).toHaveClass('opacity-0')
  })

  /**
   * A dark wing (#345) keeps its doorway but must not offer navigation into a
   * route that 404s. SVG has no `<button>`, so the inert form is a
   * `role="button"` group — named and announced, but with no href and no
   * place in the tab order.
   */
  describe('when the wing behind it is dark', () => {
    it('renders an inert button rather than a link', () => {
      const { getByRole, queryByRole } = renderInScene({ disabled: true })
      expect(queryByRole('link', { name: /enter the combine/i })).not.toBeInTheDocument()
      const door = getByRole('button', { name: /enter the combine/i })
      expect(door).toHaveAttribute('aria-disabled', 'true')
      expect(door).not.toHaveAttribute('href')
    })

    it('captions the sign "still building" in place of the wing caption', () => {
      const { getByText, queryByText } = renderInScene({ disabled: true })
      expect(getByText('still building')).toBeInTheDocument()
      expect(queryByText('movement wing')).not.toBeInTheDocument()
      // The door is dimmed, not removed — the hall is three doors by design.
      expect(getByText('The Combine')).toBeInTheDocument()
    })

    it('drops the hover tint and focus ring, which promise interactivity', () => {
      const { container } = renderInScene({ disabled: true })
      expect(container.querySelector('[stroke-dasharray]')).toBeNull()
      expect(container.querySelector('polygon.group-hover\\:opacity-10')).toBeNull()
    })
  })
})
