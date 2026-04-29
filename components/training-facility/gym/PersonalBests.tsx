import { type JSX } from 'react'
import type { CardioActivity, CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import {
  bestSession,
  pbInRange,
  type PersonalBests as PersonalBestsRecord,
} from '@/lib/training-facility/personal-bests'
import {
  formatDistanceMiles,
  formatPaceCellFromSecPerKm,
} from '@/lib/training-facility/running'
import { formatDuration, parseSessionDate } from '@/lib/training-facility/cardio-shared'

const HANDWRITING_FONT = "'Patrick Hand', system-ui, sans-serif"

/** Props for {@link PersonalBests}. */
export interface PersonalBestsProps {
  /** Activity for the host detail view — drives which per-activity PBs to surface. */
  activity: CardioActivity
  /** All-time PBs computed from the full unfiltered dataset. */
  bests: PersonalBestsRecord
  /** Sessions inside the active filter range — used for the "best in range" comparison line on each tile. */
  filteredSessions: readonly CardioSession[]
  /** Active filter range — drives the "PB set in range" badge on each tile. */
  range: DateRange
  /** Tailwind classes appended to the outer wrapper. */
  className?: string
}

/**
 * `PersonalBests` — horizontal strip of personal-best tiles for the Gym
 * detail views (PRD §7.4, issue #76). Sits between the date filter and the
 * chart grid in `TreadmillDetailView` / `StairDetailView` /
 * `TrackDetailView`.
 *
 * Five tiles in canonical order:
 *
 * 1. **Fastest pace** (per activity, lower seconds-per-km wins).
 * 2. **Longest session** (per activity, more seconds wins).
 * 3. **Longest distance** (per activity, more meters wins).
 * 4. **Lowest resting HR** (cross-cutting; from the daily resting-HR trend).
 * 5. **Highest VO₂max** (cross-cutting; from the daily VO2max trend).
 *
 * Each tile shows the all-time PB value + the date it was achieved. When the
 * active filter range *contains* the PB session, the tile gets a "PB" badge
 * and an orange ring. When the range doesn't contain the PB, an inline
 * "best in range" line shows the highest-performing in-range session for
 * the same metric (so the user can see how close they're getting to their
 * own ceiling without leaving the current view).
 *
 * Renders nothing when the dataset has zero PBs — keeps the detail view
 * clean on a fresh `cardio.json` import. Tiles for missing per-activity
 * metrics (e.g. stair sessions don't have pace) are silently omitted.
 */
export function PersonalBests({
  activity,
  bests,
  filteredSessions,
  range,
  className = '',
}: PersonalBestsProps): JSX.Element | null {
  const pacePb = bests.pace[activity]
  const durationPb = bests.duration[activity]
  const distancePb = bests.distance[activity]
  const restingHrPb = bests.restingHr
  const vo2maxPb = bests.vo2max

  // Render nothing when nothing's set yet — every tile would show a dash.
  if (!pacePb && !durationPb && !distancePb && !restingHrPb && !vo2maxPb) {
    return null
  }

  const paceInRange = bestSession(filteredSessions, 'pace_seconds_per_km', 'min')
  const durationInRange = bestSession(filteredSessions, 'duration_seconds', 'max')
  const distanceInRange = bestSession(filteredSessions, 'distance_meters', 'max')

  const tiles: TileSpec[] = []
  if (pacePb) {
    const inRange = pbInRange(pacePb, range)
    tiles.push({
      key: 'pace',
      label: 'Fastest pace',
      value: formatPaceCellFromSecPerKm(pacePb.value),
      date: pacePb.date,
      badge: inRange,
      delta:
        !inRange && paceInRange
          ? `Best in range · ${formatPaceCellFromSecPerKm(paceInRange.value)}`
          : undefined,
    })
  }
  if (durationPb) {
    const inRange = pbInRange(durationPb, range)
    tiles.push({
      key: 'duration',
      label: 'Longest session',
      value: formatDuration(durationPb.value),
      date: durationPb.date,
      badge: inRange,
      delta:
        !inRange && durationInRange
          ? `Best in range · ${formatDuration(durationInRange.value)}`
          : undefined,
    })
  }
  if (distancePb) {
    const inRange = pbInRange(distancePb, range)
    tiles.push({
      key: 'distance',
      label: 'Longest distance',
      value: formatDistanceMiles(distancePb.value),
      date: distancePb.date,
      badge: inRange,
      delta:
        !inRange && distanceInRange
          ? `Best in range · ${formatDistanceMiles(distanceInRange.value)}`
          : undefined,
    })
  }
  if (restingHrPb) {
    tiles.push({
      key: 'resting-hr',
      label: 'Lowest resting HR',
      value: `${Math.round(restingHrPb.value)} bpm`,
      date: restingHrPb.date,
      badge: pbInRange(restingHrPb, range),
    })
  }
  if (vo2maxPb) {
    tiles.push({
      key: 'vo2max',
      label: 'Highest VO₂max',
      value: vo2maxPb.value.toFixed(1),
      date: vo2maxPb.date,
      badge: pbInRange(vo2maxPb, range),
    })
  }

  return (
    <section
      aria-label="Personal bests"
      className={`mt-8 rounded-[1.6rem] border border-white/10 bg-black/25 p-5 ${className}`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white/80">
          Personal bests
        </h2>
        <p className="text-xs text-white/45">All-time</p>
      </header>
      {/*
        Hairline separators between tiles — the parent ul has `gap-px` and a
        `bg-white/10` background that bleeds through the gap, while each li
        sits on the dark page background. Same pattern as the Combine
        scoreboard's per-cell separators.
      */}
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-white/10 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <li
            key={tile.key}
            className={`relative flex flex-col bg-[#120d0a] p-4 ${
              tile.badge ? 'ring-1 ring-inset ring-orange-500/50' : ''
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              {tile.label}
            </span>
            <span
              className="mt-2 text-2xl font-bold tabular-nums text-amber-100"
              style={{ fontFamily: HANDWRITING_FONT }}
            >
              {tile.value}
            </span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
              {formatPbDate(tile.date)}
            </span>
            {tile.delta && (
              <span className="mt-2 font-mono text-[10px] tracking-[0.12em] text-white/55">
                {tile.delta}
              </span>
            )}
            {tile.badge && (
              <span
                aria-label="Personal best set in current range"
                className="absolute right-3 top-3 rounded-full border border-orange-400/50 bg-orange-500/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-orange-200"
              >
                PB
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface TileSpec {
  /** React key + canonical metric identifier. */
  key: 'pace' | 'duration' | 'distance' | 'resting-hr' | 'vo2max'
  /** Compact uppercase label rendered above the value. */
  label: string
  /** Pre-formatted display string for the value (units included). */
  value: string
  /** ISO date string of the PB session — formatted by {@link formatPbDate}. */
  date: string
  /** True when the PB session falls in the active filter range — drives the badge + ring. */
  badge: boolean
  /** Optional "best in range" comparison line, shown only when the PB is *outside* the range. */
  delta?: string
}

/**
 * Format a PB date as `YYYY-MM-DD` regardless of whether the underlying
 * record came in as a full ISO timestamp or a bare date string. Falls back
 * to the raw value when unparseable so a malformed entry doesn't render as
 * `NaN-NaN-NaN`.
 */
function formatPbDate(raw: string): string {
  const d = parseSessionDate(raw)
  if (!Number.isFinite(d.getTime())) return raw
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
