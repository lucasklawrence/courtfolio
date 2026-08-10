import type { JSX } from 'react'
import Link from 'next/link'

import {
  DEFAULT_HEATMAP_SPAN,
  HEATMAP_SPAN_PARAM,
  type HeatmapSpan,
} from '@/lib/training-facility/heatmap-span'

/** Props for {@link HeatmapSpanToggle}. */
export interface HeatmapSpanToggleProps {
  /** The span currently drawn. */
  span: HeatmapSpan
  /** Route the links point back to, e.g. `/training-facility/weight-room/history`. */
  pathname: string
  /**
   * Other search params to preserve, so switching range doesn't silently drop
   * the exercise filter or a preview tour.
   */
  carryParams?: Readonly<Record<string, string>>
}

/** The two spans, in display order. */
const OPTIONS: readonly { value: HeatmapSpan; label: string }[] = [
  { value: 'year', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

/**
 * Switch the History heatmaps between a trailing year and the whole log (#438).
 *
 * Links rather than buttons, and resolved on the server like the exercise
 * filter beside it: the route is already dynamic, so a *linked* all-time view
 * paints correctly on first byte with no flash of the trailing year and no
 * dependence on JS having loaded.
 *
 * A Server Component.
 */
export function HeatmapSpanToggle({
  span,
  pathname,
  carryParams = {},
}: HeatmapSpanToggleProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="heatmap-span-toggle">
      <span
        id="heatmap-span-label"
        className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70"
      >
        Range
      </span>
      <nav aria-labelledby="heatmap-span-label" className="flex flex-wrap gap-2">
        {OPTIONS.map(({ value, label }) => {
          const isOn = value === span
          return (
            <Link
              key={value}
              href={buildHref(value, pathname, carryParams)}
              scroll={false}
              data-testid={`heatmap-span-${value}`}
              data-selected={isOn}
              aria-current={isOn ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                isOn
                  ? 'border-amber-300/50 bg-amber-300/15 text-amber-100'
                  : 'border-white/20 text-white/45 hover:text-white/70'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

/**
 * Compose the href that switches to `span`.
 *
 * An absolute `pathname` rather than a bare `?query`: Next's `<Link>` does not
 * resolve a query-only relative href against the current route, so the chips
 * beside this render one too.
 *
 * @param span The range this link switches to.
 * @param pathname Route to link to.
 * @param carryParams Unrelated params to preserve.
 * @returns A route-relative URL; the default range is spelled as the *absence*
 *   of the param, so the canonical view keeps a clean URL and a link shared
 *   without one lands where a reader starts.
 */
function buildHref(
  span: HeatmapSpan,
  pathname: string,
  carryParams: Readonly<Record<string, string>>
): string {
  const params = new URLSearchParams(carryParams)
  if (span === DEFAULT_HEATMAP_SPAN) params.delete(HEATMAP_SPAN_PARAM)
  else params.set(HEATMAP_SPAN_PARAM, span)
  const query = params.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}
