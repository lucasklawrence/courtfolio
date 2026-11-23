import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { HeatmapInspector } from './HeatmapInspector'

/** Reads `col,row` into the day text each test cell's `<title>` carries. */
function dayText(col: number, row: number): string {
  return `Day ${col},${row}`
}

/** A 2-week grid shaped like the real heatmaps, plus a legend swatch and a label. */
function Grid({ prefix = '' }: { prefix?: string }) {
  return (
    <svg role="img" aria-label="grid">
      {[0, 1].flatMap(col =>
        [0, 1, 2, 3, 4, 5, 6].map(row => (
          <rect key={`${col}-${row}`} data-col={col} data-row={row}>
            <title>{`${prefix}${dayText(col, row)}`}</title>
          </rect>
        ))
      )}
      <rect data-testid="legend" />
      <text data-testid="label">Mon</text>
    </svg>
  )
}

function renderInspector() {
  const view = render(
    <main>
      <h1 data-testid="outside">Outside</h1>
      <HeatmapInspector label="Pushups heatmap">
        <Grid />
      </HeatmapInspector>
    </main>
  )
  const cell = (col: number, row: number) =>
    view.container.querySelector(`rect[data-col="${col}"][data-row="${row}"]`) as Element
  const selectedCells = () => view.container.querySelectorAll('[data-heatmap-selected]')
  return { ...view, cell, selectedCells }
}

const readout = () => screen.getByTestId('heatmap-cell-detail')
const grid = () => screen.getByRole('group', { name: /Pushups heatmap/ })
const HINT = 'Select a day to see its breakdown.'

beforeAll(() => {
  // jsdom doesn't implement it, and every keyboard move calls it.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('HeatmapInspector', () => {
  it('prompts for a selection until a day is chosen', () => {
    renderInspector()
    expect(readout()).toHaveTextContent(HINT)
  })

  it("shows a tapped cell's details and marks it selected", () => {
    const { cell, selectedCells } = renderInspector()
    fireEvent.click(cell(1, 2))
    expect(readout()).toHaveTextContent(dayText(1, 2))
    expect(selectedCells()).toHaveLength(1)
    expect(cell(1, 2)).toHaveAttribute('data-heatmap-selected')
  })

  it('moves the selection when another cell is tapped', () => {
    const { cell, selectedCells } = renderInspector()
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1))
    expect(readout()).toHaveTextContent(dayText(1, 1))
    expect(selectedCells()).toHaveLength(1)
  })

  it('dismisses when the selected cell is tapped again', () => {
    const { cell, selectedCells } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.click(cell(1, 2))
    expect(readout()).toHaveTextContent(HINT)
    expect(selectedCells()).toHaveLength(0)
  })

  it('dismisses on a tap outside the inspector', () => {
    const { cell, selectedCells } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.pointerDown(screen.getByTestId('outside'))
    fireEvent.pointerUp(screen.getByTestId('outside'))
    expect(readout()).toHaveTextContent(HINT)
    expect(selectedCells()).toHaveLength(0)
  })

  it('does not dismiss when an outside gesture scrolls the page', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.pointerDown(screen.getByTestId('outside'))
    fireEvent.scroll(document)
    fireEvent.pointerUp(screen.getByTestId('outside'))
    expect(readout()).toHaveTextContent(dayText(1, 2))
  })

  it('does not dismiss a cancelled outside gesture', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.pointerDown(screen.getByTestId('outside'))
    fireEvent.pointerCancel(screen.getByTestId('outside'))
    fireEvent.pointerUp(screen.getByTestId('outside'))
    expect(readout()).toHaveTextContent(dayText(1, 2))
  })

  it('focuses the inspector after selecting a day inside a focusable scroller', () => {
    const { container } = render(
      <HeatmapInspector label="Pushups heatmap">
        <div tabIndex={0}>
          <Grid />
        </div>
      </HeatmapInspector>
    )
    fireEvent.click(container.querySelector('rect[data-col="1"][data-row="2"]')!)
    expect(grid()).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(readout()).toHaveTextContent(dayText(1, 3))
  })

  it('dismisses on a tap on a part of the chart that is not a cell', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.click(screen.getByTestId('label'))
    expect(readout()).toHaveTextContent(HINT)
  })

  it('does not treat a legend swatch as a day', () => {
    renderInspector()
    fireEvent.click(screen.getByTestId('legend'))
    expect(readout()).toHaveTextContent(HINT)
  })

  it('keeps the details open when the readout itself is tapped', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.pointerDown(readout())
    fireEvent.click(readout())
    expect(readout()).toHaveTextContent(dayText(1, 2))
  })

  it('makes the grid reachable by keyboard', () => {
    renderInspector()
    expect(grid()).toHaveAttribute('tabindex', '0')
  })

  it("starts the arrow keys on the last drawn week's Monday", () => {
    renderInspector()
    fireEvent.keyDown(grid(), { key: 'ArrowRight' })
    expect(readout()).toHaveTextContent(dayText(1, 0))
  })

  it('moves between days with the arrow keys', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(1, 1))
    fireEvent.keyDown(grid(), { key: 'ArrowDown' })
    expect(readout()).toHaveTextContent(dayText(1, 2))
    fireEvent.keyDown(grid(), { key: 'ArrowLeft' })
    expect(readout()).toHaveTextContent(dayText(0, 2))
    fireEvent.keyDown(grid(), { key: 'ArrowUp' })
    expect(readout()).toHaveTextContent(dayText(0, 1))
    fireEvent.keyDown(grid(), { key: 'ArrowRight' })
    expect(readout()).toHaveTextContent(dayText(1, 1))
  })

  it('stays put at the edge of the grid', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(grid(), { key: 'ArrowLeft' })
    fireEvent.keyDown(grid(), { key: 'ArrowUp' })
    expect(readout()).toHaveTextContent(dayText(0, 0))
  })

  it('claims the arrow keys so the page does not scroll instead', () => {
    renderInspector()
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.keyDown(grid(), { key: 'ArrowDown' })).toBe(false)
  })

  it('leaves other keys to the browser', () => {
    renderInspector()
    expect(fireEvent.keyDown(grid(), { key: 'Tab' })).toBe(true)
    expect(readout()).toHaveTextContent(HINT)
  })

  it('dismisses on Escape', () => {
    const { selectedCells } = renderInspector()
    fireEvent.keyDown(grid(), { key: 'ArrowDown' })
    fireEvent.keyDown(grid(), { key: 'Escape' })
    expect(readout()).toHaveTextContent(HINT)
    expect(selectedCells()).toHaveLength(0)
  })

  it('leaves arrow keys with a modifier to the browser', () => {
    renderInspector()
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      expect(fireEvent.keyDown(grid(), { key: 'ArrowLeft', [modifier]: true })).toBe(true)
    }
    expect(readout()).toHaveTextContent(HINT)
  })

  it('leaves arrow keys to a focusable scroller nested in the grid', () => {
    render(
      <HeatmapInspector label="Pushups heatmap">
        <div data-testid="scroller" tabIndex={0}>
          <Grid />
        </div>
      </HeatmapInspector>
    )
    expect(fireEvent.keyDown(screen.getByTestId('scroller'), { key: 'ArrowLeft' })).toBe(true)
    expect(readout()).toHaveTextContent(HINT)
  })

  it('dismisses when focus moves to something outside the inspector', () => {
    const { selectedCells } = renderInspector()
    fireEvent.keyDown(grid(), { key: 'ArrowDown' })
    fireEvent.focusOut(grid(), { relatedTarget: screen.getByTestId('outside') })
    expect(readout()).toHaveTextContent(HINT)
    expect(selectedCells()).toHaveLength(0)
  })

  it('keeps the details open when focus goes nowhere, as on a tap on the readout', () => {
    const { cell } = renderInspector()
    fireEvent.click(cell(1, 2))
    fireEvent.focusOut(grid(), { relatedTarget: null })
    expect(readout()).toHaveTextContent(dayText(1, 2))
  })

  it('announces a selected day but not the hint', () => {
    const { cell } = renderInspector()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    fireEvent.click(cell(1, 2))
    expect(screen.getByRole('status')).toHaveTextContent(dayText(1, 2))
    fireEvent.click(cell(1, 2))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('dismisses when a re-render gives the selected square a different day', async () => {
    const { cell, rerender, selectedCells } = renderInspector()
    fireEvent.click(cell(1, 2))

    await act(async () => {
      rerender(
        <main>
          <h1 data-testid="outside">Outside</h1>
          <HeatmapInspector label="Pushups heatmap">
            <Grid prefix="Next " />
          </HeatmapInspector>
        </main>
      )
    })

    expect(readout()).toHaveTextContent(HINT)
    expect(selectedCells()).toHaveLength(0)
  })

  it('keeps the selection through a re-render that changes nothing', async () => {
    const { cell, rerender } = renderInspector()
    fireEvent.click(cell(1, 2))

    await act(async () => {
      rerender(
        <main>
          <h1 data-testid="outside">Outside</h1>
          <HeatmapInspector label="Pushups heatmap">
            <Grid />
          </HeatmapInspector>
        </main>
      )
    })

    expect(readout()).toHaveTextContent(dayText(1, 2))
  })
})
