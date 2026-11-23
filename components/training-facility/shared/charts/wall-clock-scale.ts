import { scaleUtc } from 'd3-scale'

import { fromWallClockMs, wallClockMs } from '@/lib/training-facility/clock'
import { extent } from './rough-svg'

/** A horizontal scale over wall-clock `Date`s. See {@link wallClockTimeScale}. */
export interface WallClockTimeScale {
  /** Width of the domain on the {@link wallClockMs} timeline, in milliseconds. */
  spanMs: number
  /** The range position of a wall-clock `Date`. */
  position(date: Date): number
  /**
   * Nicely rounded axis ticks across the domain.
   *
   * @param count Approximate number of ticks, as `d3-scale` treats it.
   * @returns Each tick's position, with a `Date` whose local getters read that tick.
   */
  ticks(count: number): { date: Date; offset: number }[]
}

/**
 * A time scale that gives the same positions and ticks in every timezone, for
 * charts rendered on a UTC server and hydrated in a viewer's browser.
 *
 * `scaleTime` measures with `getTime()`, so a chart spanning a clock change comes
 * out differently in a zone that changes its clocks than in one that doesn't, and
 * React reports the mismatch. This places dates on the {@link wallClockMs} timeline
 * instead, which has no clock changes.
 *
 * @param dates Every date the scale has to fit. The domain is their extent.
 * @param range Output range, usually `[0, innerWidth]`.
 */
export function wallClockTimeScale(
  dates: readonly Date[],
  range: [number, number]
): WallClockTimeScale {
  const [min, max] = extent(dates.map(wallClockMs))
  const scale = scaleUtc()
    .domain([new Date(min), new Date(max)])
    .range(range)
  return {
    spanMs: max - min,
    position: date => scale(new Date(wallClockMs(date))),
    ticks: count =>
      scale.ticks(count).map(tick => ({
        date: fromWallClockMs(tick.getTime()),
        offset: scale(tick),
      })),
  }
}
