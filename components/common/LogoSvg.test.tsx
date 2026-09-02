import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { LogoSvg } from './LogoSvg'

/**
 * The regression these pin: the logo used to render as
 * `<use href="/common/LogoSvg.svg#LogoSvg">`, whose shadow tree resolved its
 * `textPath` and `filter` fragments against the host document — where those ids
 * did not exist. iOS Safari dropped them, so the ring text disappeared on
 * mobile while the rest of the mark still drew.
 *
 * Every assertion here is really one question: does each fragment reference
 * point at an element that is present in the same rendered output?
 */
describe('LogoSvg', () => {
  it('renders the mark inline rather than referencing an external file', () => {
    const { container } = render(<LogoSvg />)
    expect(container.querySelector('use')).toBeNull()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('resolves every fragment reference within its own output', () => {
    const { container } = render(<LogoSvg />)
    const svg = container.querySelector('svg') as SVGSVGElement

    const referenced = [
      ...[...svg.querySelectorAll('[filter]')].map(el =>
        (el.getAttribute('filter') ?? '').replace(/^url\(#/, '').replace(/\)$/, '')
      ),
      ...[...svg.querySelectorAll('textPath')].map(el =>
        (el.getAttribute('href') ?? '').replace(/^#/, '')
      ),
    ].filter(Boolean)

    // Sanity: the mark does use fragments, so an empty list would mean this
    // test silently stopped checking anything.
    expect(referenced.length).toBeGreaterThan(0)

    for (const id of referenced) {
      expect(svg.querySelector(`#${CSS.escape(id)}`)).not.toBeNull()
    }
  })

  it('puts the ring text on the circular path', () => {
    const { container } = render(<LogoSvg />)
    const textPath = container.querySelector('textPath')
    expect(textPath?.textContent).toMatch(/HOOPER/)
    expect(textPath?.textContent).toMatch(/CODE STORYTELLER/)
  })

  it('keeps the two centred name lines', () => {
    const { container } = render(<LogoSvg />)
    const lines = [...container.querySelectorAll('text')]
      .map(t => t.textContent?.trim())
      .filter(t => t === 'LUCAS' || t === 'LAWRENCE')
    expect(lines).toEqual(['LUCAS', 'LAWRENCE'])
  })

  it('is announced as a single labelled image', () => {
    const { container } = render(<LogoSvg />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('aria-label', 'Lucas Lawrence')
  })
})
