import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { SceneDoor } from './SceneDoor'

/**
 * Smoke coverage for the shared cross-link door (#190 hardening of the
 * #176 extraction). The two callers (`DoorToCombine`, `DoorToGym`) are
 * thin wrappers, so anything that reads the same per-call props goes
 * through this component — verifying href + accessible name + sign
 * text + focus-ring presence here keeps both call sites honest.
 *
 * Renders inside an `<svg>` because `SceneDoor` is composed of SVG
 * primitives intended to live inside a scene viewBox.
 */
describe('SceneDoor', () => {
  function renderInScene(extraProps: Partial<React.ComponentProps<typeof SceneDoor>> = {}) {
    return render(
      <svg viewBox="0 0 1600 800" data-testid="scene">
        <SceneDoor
          href="/training-facility/combine"
          ariaLabel="Walk through the back door into The Combine"
          signText="→ the combine"
          x={1300}
          seedBase={210}
          {...extraProps}
        />
      </svg>,
    )
  }

  it('renders a Next link pointed at the supplied href with the accessible label', () => {
    const { getByRole } = renderInScene()
    const link = getByRole('link', { name: /walk through the back door into the combine/i })
    expect(link).toHaveAttribute('href', '/training-facility/combine')
  })

  it('paints the supplied sign text inside the door group', () => {
    const { getByText } = renderInScene({ signText: '→ the gym' })
    expect(getByText('→ the gym')).toBeInTheDocument()
  })

  it('defaults the floor caption to "back door" when no override is supplied', () => {
    const { getByText } = renderInScene()
    expect(getByText('back door')).toBeInTheDocument()
  })

  it('honors a custom caption when one is supplied', () => {
    const { getByText, queryByText } = renderInScene({ captionText: 'side entrance' })
    expect(getByText('side entrance')).toBeInTheDocument()
    expect(queryByText('back door')).not.toBeInTheDocument()
  })

  it('includes the focus-visible dashed ring overlay', () => {
    const { container } = renderInScene()
    // The focus ring is the only `<rect>` with stroke-dasharray on the
    // door — locating it via the dasharray attribute keeps the test
    // resilient to surrounding markup churn.
    const ring = container.querySelector('rect[stroke-dasharray]')
    expect(ring).not.toBeNull()
    // Hidden by default; only the parent `:focus-visible` reveals it.
    expect(ring).toHaveClass('opacity-0')
    expect(ring?.getAttribute('class')).toContain('group-focus-visible:opacity-100')
  })

  it('renders a translucent hover-tint overlay on the inner panel', () => {
    const { container } = renderInScene()
    // The overlay is the only `<rect>` carrying `group-hover:opacity-100`.
    const overlay = container.querySelector('rect.group-hover\\:opacity-100')
    expect(overlay).not.toBeNull()
    expect(overlay).toHaveClass('opacity-0')
  })
})
