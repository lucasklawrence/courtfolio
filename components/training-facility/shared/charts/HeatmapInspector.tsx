'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

/** Props for {@link HeatmapInspector}. */
export interface HeatmapInspectorProps {
  /**
   * The heatmap, including its horizontal scroller. Inspectable cells are
   * `<rect data-col data-row>` elements whose `<title>` holds the day's details.
   */
  children: ReactNode
  /** Accessible name for the focusable grid, e.g. `"Pushups heatmap"`. */
  label: string
  /**
   * Classes for the wrapper. Its text color also draws the selected cell's
   * outline, so it has to contrast with the surface behind the heatmap.
   */
  className?: string
}

/** Readout text while no day is selected. */
const HINT = 'Select a day to see its breakdown.'
/** Matches an inspectable cell; legend swatches carry no `data-col`. */
const CELL_SELECTOR = 'rect[data-col]'
/** Marks the selected cell, for the outline drawn from the wrapper's classes. */
const SELECTED_ATTRIBUTE = 'data-heatmap-selected'
/** Column and row step for each arrow key. */
const ARROW_STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** The details a cell's native tooltip shows. */
function cellDetail(cell: Element): string {
  return cell.querySelector('title')?.textContent ?? ''
}

/**
 * Adds touch and keyboard access to a heatmap's per-day details, which an SVG
 * `<title>` only exposes on hover. Tapping or clicking a cell shows its details
 * below the grid. Tapping the same cell or anywhere else dismisses them. With the
 * grid focused, arrow keys move between days, and Escape or moving focus away
 * dismisses. The `<title>` stays in place, so desktop hover keeps its native tooltip.
 *
 * Selection reads the DOM rather than receiving the cells as props, so a
 * server-rendered heatmap stays server-rendered and the browser receives no
 * second copy of every cell's text.
 *
 * Scrolling can't open details by accident because it relies on `click`, which
 * browsers don't fire for a touch that became a pan. The readout sits outside the
 * scroller, so it stays in view however far the grid has scrolled, and its space
 * is reserved so selecting a day doesn't move the page.
 */
export function HeatmapInspector({
  children,
  label,
  className = '',
}: HeatmapInspectorProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<Element | null>(null)
  const detailRef = useRef<string | null>(null)
  const readoutRef = useRef<HTMLParagraphElement>(null)
  const [detail, setDetail] = useState<string | null>(null)

  const select = useCallback((cell: Element | null) => {
    selectedRef.current?.removeAttribute(SELECTED_ATTRIBUTE)
    selectedRef.current = cell
    cell?.setAttribute(SELECTED_ATTRIBUTE, '')
    detailRef.current = cell === null ? null : cellDetail(cell)
    setDetail(detailRef.current)
  }, [])

  const isOpen = detail !== null

  useEffect(() => {
    if (!isOpen) return
    // Wait for a completed tap. A swipe starting outside the chart may be the
    // reader scrolling down to its details, not a request to dismiss them.
    let tap: { id: number; x: number; y: number } | null = null
    const start = (event: PointerEvent) => {
      tap = rootRef.current?.contains(event.target as Node)
        ? null
        : { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const cancel = () => {
      tap = null
    }
    const move = (event: PointerEvent) => {
      if (
        tap &&
        (event.pointerId !== tap.id || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8)
      )
        cancel()
    }
    const finish = (event: PointerEvent) => {
      move(event)
      if (tap && !rootRef.current?.contains(event.target as Node)) select(null)
      cancel()
    }
    document.addEventListener('pointerdown', start)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('scroll', cancel, true)
    return () => {
      document.removeEventListener('pointerdown', start)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('scroll', cancel, true)
    }
  }, [isOpen, select])

  useEffect(() => {
    const grid = gridRef.current
    if (grid === null) return
    grid.setAttribute('data-heatmap-ready', '')
    // A filter or range change reuses these elements for different days, so the
    // readout would otherwise describe a day the highlighted square no longer is.
    const observer = new MutationObserver(() => {
      const cell = selectedRef.current
      if (cell !== null && (!cell.isConnected || cellDetail(cell) !== detailRef.current))
        select(null)
    })
    observer.observe(grid, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      grid.removeAttribute('data-heatmap-ready')
    }
  }, [select])

  useEffect(() => {
    if (detail !== null) readoutRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [detail])

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const cell = (event.target as Element).closest(CELL_SELECTOR)
    if (cell !== null) gridRef.current?.focus({ preventScroll: true })
    select(cell === selectedRef.current ? null : cell)
  }

  // A null `relatedTarget` means focus went nowhere: a tap on the readout, or the
  // window losing focus. Neither is the user leaving for something else.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next !== null && !rootRef.current?.contains(next)) select(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      select(null)
      return
    }
    // Arrow keys with a modifier are browser shortcuts such as Alt+Left for Back.
    // A focusable scroller nested in the grid keeps its arrows for panning, which
    // moving one day at a time can't replace across a multi-year chart.
    const isPlainKey = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
    if (!isPlainKey || event.target !== event.currentTarget) return
    const step = ARROW_STEPS[event.key]
    const grid = gridRef.current
    if (step === undefined || grid === null) return
    event.preventDefault()

    const current = selectedRef.current
    const next = current === null ? latestMonday(grid) : neighbor(grid, current, step)
    if (next === null) return
    select(next)
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div
      ref={rootRef}
      data-testid="heatmap-inspector"
      // Tailwind needs these selectors as literals, so they repeat CELL_SELECTOR and
      // SELECTED_ATTRIBUTE. Keep them in step; the e2e keyboard test checks the outline.
      className={`[&_rect[data-col]]:cursor-pointer [&_rect[data-col]]:[stroke-width:2px] [&_rect[data-col]]:[stroke:transparent] [&_rect[data-heatmap-selected]]:[stroke:currentColor] ${className}`}
    >
      {/* The transparent stroke extends each cell's hit area across the gap
          around it. Annotation rules retain their own native tooltips.
          The outline is inset because
          the Cardio Overview's card clips anything outside this element. */}
      <div
        ref={gridRef}
        role="group"
        aria-label={`${label}. Use the arrow keys to read each day.`}
        tabIndex={0}
        onClick={handleClick}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="touch-manipulation rounded-md [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current"
      >
        {children}
      </div>
      {/* The hint sits outside the live region so that dismissing a day doesn't
          announce it as news. The region stays mounted so screen readers are
          already watching it when the first day is selected. */}
      <p
        ref={readoutRef}
        data-testid="heatmap-cell-detail"
        className="mt-2 h-20 overflow-y-auto break-words text-xs leading-5"
      >
        {detail === null ? HINT : null}
        <span role="status">{detail}</span>
      </p>
    </div>
  )
}

/**
 * The Monday of the last week drawn, where arrow keys start. It's the newest cell
 * guaranteed not to be in the future, since a grid runs through the current week.
 */
function latestMonday(grid: Element): Element | null {
  const mondays = grid.querySelectorAll(`${CELL_SELECTOR}[data-row="0"]`)
  return mondays[mondays.length - 1] ?? null
}

/** The cell one step from `cell`, or `null` at the edge of the grid. */
function neighbor(grid: Element, cell: Element, [colStep, rowStep]: readonly [number, number]) {
  const col = Number(cell.getAttribute('data-col')) + colStep
  const row = Number(cell.getAttribute('data-row')) + rowStep
  return grid.querySelector(`${CELL_SELECTOR}[data-col="${col}"][data-row="${row}"]`)
}
