/**
 * Tests for {@link RoughBar}'s axis labelling.
 *
 * `xTickLabel` was added for a five-year monthly series whose category labels
 * would otherwise render as one illegible smear (#437). It is a prop on a
 * primitive several other charts use, so it's tested here rather than only
 * through the one chart that currently passes it — a break would otherwise
 * surface as a mislabelled axis on whichever chart adopts it next.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RoughBar } from './RoughBar'

const DATA = [
  { key: '2022-01', value: 3 },
  { key: '2022-02', value: 5 },
  { key: '2022-03', value: 8 },
]

function renderBar(xTickLabel?: (category: string, index: number) => string | null) {
  return render(
    <RoughBar
      data={DATA}
      x={d => d.key}
      y={d => d.value}
      width={400}
      height={200}
      ariaLabel="test chart"
      {...(xTickLabel === undefined ? {} : { xTickLabel })}
    />
  )
}

describe('RoughBar xTickLabel', () => {
  it('labels every category when the prop is omitted', () => {
    // The default the dozen-bar charts this started with rely on.
    renderBar()
    for (const row of DATA) expect(screen.getByText(row.key)).toBeInTheDocument()
  })

  it('relabels a tick', () => {
    renderBar(category => category.slice(0, 4))
    expect(screen.getAllByText('2022')).toHaveLength(DATA.length)
    expect(screen.queryByText('2022-01')).toBeNull()
  })

  it('omits a tick whose label is null, without dropping its bar', () => {
    const { container } = renderBar(category => (category === '2022-02' ? null : category))
    expect(screen.queryByText('2022-02')).toBeNull()
    expect(screen.getByText('2022-01')).toBeInTheDocument()
    expect(screen.getByText('2022-03')).toBeInTheDocument()
    // Same bar count as the unlabelled render — omitting a label must not
    // remove data.
    const { container: all } = renderBar()
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(
      all.querySelectorAll('path').length - 2
    )
  })

  it('passes the category index, so a caller can label the first tick specially', () => {
    const seen: number[] = []
    renderBar((category, index) => {
      seen.push(index)
      return index === 0 ? 'first' : null
    })
    expect(seen).toEqual([0, 1, 2])
    expect(screen.getByText('first')).toBeInTheDocument()
  })
})
