'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'

import type { CardioSession, HrZone } from '@/types/cardio'
import { aggregateHrZoneSeconds } from '@/lib/training-facility/cardio-shared'
import { HrZoneBars } from './HrZoneBars'

/** Initial render width for the expansion panel before `ResizeObserver` fires. */
const DEFAULT_PANEL_WIDTH = 560

/** Floor on the panel's measured width — keeps the chart readable on narrow viewports. */
const MIN_PANEL_WIDTH = 280

/** Vertical room reserved for the expanded zone-bars chart. */
const PANEL_HEIGHT = 200

/**
 * State + toggle returned by {@link useSessionRowExpansion}. Exactly one row
 * may be open at a time across the parent table — opening a new key replaces
 * any previously expanded key.
 */
export interface SessionRowExpansionState {
  /** Composite key of the currently expanded row, or `null` if none. */
  readonly expandedKey: string | null
  /**
   * Toggle expansion for the given key. Re-applying the same key collapses
   * the row; a different key replaces the open row in a single render.
   */
  toggle: (key: string) => void
}

/**
 * Single-row expansion controller for the cardio session-log tables. Holds
 * one composite key (or `null`) so opening row B implicitly closes row A —
 * the table never renders two expansion panels at once.
 */
export function useSessionRowExpansion(): SessionRowExpansionState {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const toggle = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])
  return { expandedKey, toggle }
}

/**
 * True iff the session has at least one logged second across Z1–Z5. Sessions
 * that come back from `cardio.json` without `hr_seconds_in_zone` (Apple Watch
 * off) or with all zones at zero return `false` — those rows skip the
 * expansion affordance entirely so the user can't open an empty chart.
 */
export function hasZoneData(hrSecondsInZone?: Record<HrZone, number>): boolean {
  if (!hrSecondsInZone) return false
  return (Object.values(hrSecondsInZone) as number[]).some((v) => (v ?? 0) > 0)
}

/**
 * Props returned by {@link getRowExpansionProps} — designed to spread directly
 * onto a `<tr>`. Each field is `undefined` when the row is non-interactive
 * (no zone data) so React treats the prop as unset rather than binding a
 * no-op handler.
 */
export interface RowExpansionProps {
  /** `'button'` when interactive; `undefined` otherwise. */
  role: 'button' | undefined
  /** `0` when interactive (focusable); `undefined` otherwise (not in the tab order). */
  tabIndex: number | undefined
  /** Reflects the current expansion state. `undefined` when the row has no expansion. */
  'aria-expanded': boolean | undefined
  /** Click toggle. `undefined` when the row has no expansion. */
  onClick: ((e: MouseEvent<HTMLTableRowElement>) => void) | undefined
  /** Keyboard toggle on Enter/Space. `undefined` when the row has no expansion. */
  onKeyDown: ((e: KeyboardEvent<HTMLTableRowElement>) => void) | undefined
  /** Final className — extends `baseClassName` with focus / hover states when interactive. */
  className: string
}

/**
 * Build the a11y + interaction props for a session-log row. Keeps the four
 * cardio session-log tables (overview / stair / treadmill / track) in sync on
 * keyboard support, hover/focus styling, and `aria-expanded` semantics so
 * each table doesn't reinvent the same wiring.
 *
 * @param key composite row key — pass the same string the parent uses for React's `key`.
 * @param state value returned by {@link useSessionRowExpansion}.
 * @param hasZoneData whether the session has any zone-time logged.
 *   `false` returns inert props so the row stays out of the tab order.
 * @param baseClassName the row's existing class string — preserved as-is and
 *   suffixed with focus / hover utilities only when the row is interactive.
 */
export function getRowExpansionProps(
  key: string,
  state: SessionRowExpansionState,
  hasZoneData: boolean,
  baseClassName: string,
): RowExpansionProps {
  if (!hasZoneData) {
    return {
      role: undefined,
      tabIndex: undefined,
      'aria-expanded': undefined,
      onClick: undefined,
      onKeyDown: undefined,
      className: baseClassName,
    }
  }
  const isExpanded = state.expandedKey === key
  return {
    role: 'button',
    tabIndex: 0,
    'aria-expanded': isExpanded,
    onClick: () => state.toggle(key),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        state.toggle(key)
      }
    },
    className: `${baseClassName} cursor-pointer transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none aria-expanded:bg-white/10`,
  }
}

/** Props for {@link ExpandedHrZoneRow}. */
export interface ExpandedHrZoneRowProps {
  /** Session whose zone breakdown is rendered in the expansion panel. */
  session: CardioSession
  /** Number of columns in the parent table — used as the cell's `colSpan`. */
  colSpan: number
  /**
   * Optional font family forwarded to {@link HrZoneBars}. Cardio surfaces use
   * `'Patrick Hand', system-ui, sans-serif`; omit to inherit.
   */
  fontFamily?: string
}

/**
 * Expanded `<tr>` rendered immediately below a clicked row. Hosts a single
 * `<HrZoneBars>` instance keyed to the session's `hr_seconds_in_zone` so the
 * five-zone breakdown reads at full chart fidelity instead of the inline
 * sparkline strip from {@link SessionZoneStrip}.
 *
 * Width tracks the cell via `ResizeObserver` (mirroring the per-card sizing
 * pattern used by `AllCardioOverview` / `StairDetailView` / etc.); SSR or
 * environments without `ResizeObserver` fall back to the initial width.
 *
 * Mount-fade: opacity transitions from 0 → 100 over 150ms after the panel
 * mounts so it doesn't hard-pop into existence. Collapse is unanimated —
 * the row simply unmounts when `expandedKey` no longer matches.
 */
export function ExpandedHrZoneRow({
  session,
  colSpan,
  fontFamily,
}: ExpandedHrZoneRowProps): JSX.Element {
  const sizerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const node = sizerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(MIN_PANEL_WIDTH, Math.floor(entry.contentRect.width))
        setWidth((prev) => (prev === next ? prev : next))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const buckets = useMemo(() => aggregateHrZoneSeconds([session]), [session])

  return (
    <tr data-testid="session-row-expansion">
      <td colSpan={colSpan} className="rounded-md bg-white/5 px-4 py-4">
        <div
          ref={sizerRef}
          className={`transition-opacity duration-150 ease-out ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <HrZoneBars
            buckets={buckets}
            width={width}
            height={PANEL_HEIGHT}
            fontFamily={fontFamily}
          />
        </div>
      </td>
    </tr>
  )
}
