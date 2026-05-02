import type { JSX } from 'react'

import { HR_ZONES } from '@/constants/hr-zones'
import type { HrZone } from '@/types/cardio'

/**
 * Width of the rendered strip in pixels. Fixed (rather than fluid) so the
 * sparkline reads at a consistent visual weight across all four session-log
 * tables, regardless of the surrounding column's flex behavior.
 */
const STRIP_WIDTH_PX = 80

/** Height of the rendered strip in pixels. Tuned to match the row's text height. */
const STRIP_HEIGHT_PX = 10

/** Props for {@link SessionZoneStrip}. */
export interface SessionZoneStripProps {
  /**
   * Time spent in each HR zone for a single session, keyed by zone id (1–5).
   * `undefined` (Apple Watch off) and an all-zero map both render as the
   * em-dash fallback — neither has anything meaningful to show.
   */
  hrSecondsInZone?: Record<HrZone, number>
}

/**
 * Inline 5-segment zone strip — a sparkline-class summary of how a single
 * session's heart-rate time was distributed across Z1–Z5. Sits in the new
 * "Zone" column on every cardio session-log table (PRD §7.4) so a viewer
 * can scan rows and tell Z2 endurance work apart from Z4 grinders without
 * opening a chart.
 *
 * Segments use the canonical zone palette from {@link HR_ZONES}; widths are
 * proportional to seconds in zone. A native `title=` tooltip exposes the
 * exact per-zone breakdown on hover (and via long-press on touch devices).
 *
 * Sessions with no usable zone data — `undefined` field, or every zone at
 * zero — render as a centered em-dash span instead of a zero-width bar so
 * the column doesn't visually disappear.
 */
export function SessionZoneStrip({ hrSecondsInZone }: SessionZoneStripProps): JSX.Element {
  const total = hrSecondsInZone
    ? (Object.values(hrSecondsInZone) as number[]).reduce((acc, v) => acc + (v ?? 0), 0)
    : 0

  if (!hrSecondsInZone || total <= 0) {
    return (
      <span aria-label="No zone data" className="font-mono text-white/35">
        —
      </span>
    )
  }

  const tooltip = HR_ZONES.map((z, i) => {
    const seconds = hrSecondsInZone[(i + 1) as HrZone] ?? 0
    return `${z.shortLabel}: ${formatZoneTime(seconds)}`
  }).join(', ')

  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className="inline-flex overflow-hidden rounded-sm border border-white/15"
      style={{ width: `${STRIP_WIDTH_PX}px`, height: `${STRIP_HEIGHT_PX}px` }}
    >
      {HR_ZONES.map((zone, i) => {
        const seconds = hrSecondsInZone[(i + 1) as HrZone] ?? 0
        if (seconds <= 0) return null
        const widthPct = (seconds / total) * 100
        return (
          <span
            key={zone.id}
            data-testid={`zone-segment-${zone.id}`}
            aria-hidden="true"
            className="h-full"
            style={{ width: `${widthPct}%`, backgroundColor: zone.color }}
          />
        )
      })}
    </span>
  )
}

/**
 * Format a zone duration for the tooltip. Sub-minute spans render as `Ss`,
 * everything else as `Mm Ss` (matching `formatDuration` in
 * `lib/training-facility/cardio-shared.ts`) so the tooltip line for a
 * 12-second Z5 doesn't read as `0m 12s`.
 */
function formatZoneTime(seconds: number): string {
  const total = Math.round(seconds)
  if (total < 60) return `${total}s`
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}
