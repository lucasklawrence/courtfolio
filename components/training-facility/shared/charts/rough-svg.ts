import type { Drawable } from 'roughjs/bin/core'
import type { RoughGenerator } from 'roughjs/bin/generator'
import rough from 'roughjs'

let _generator: RoughGenerator | null = null

/**
 * Single shared RoughGenerator. `rough.generator()` doesn't touch the DOM,
 * so it's SSR-safe and there's no reason to allocate one per chart.
 */
export function getGenerator(): RoughGenerator {
  if (!_generator) _generator = rough.generator()
  return _generator
}

export interface DrawablePath {
  d: string
  stroke: string
  strokeWidth: number
  fill?: string
}

/** Matches a decimal number in SVG path data. */
const PATH_DECIMAL = /-?\d+\.\d+/g

/**
 * Round an SVG coordinate to 2 decimals, far below a visible pixel. The server and
 * browser can compute a coordinate that differs in its last digits, which React
 * reports as a hydration mismatch and doesn't patch up.
 */
export function roundSvgCoordinate(value: number): number {
  return Number(value.toFixed(2))
}

/**
 * Convert a rough.js Drawable into plain SVG path data, with coordinates rounded by
 * {@link roundSvgCoordinate}. Keeps render declarative — callers map these into
 * `<path>` elements directly.
 */
export function drawableToPaths(drawable: Drawable): DrawablePath[] {
  return getGenerator()
    .toPaths(drawable)
    .map(path => ({
      ...path,
      d: path.d.replace(PATH_DECIMAL, value => String(roundSvgCoordinate(Number(value)))),
    }))
}

/**
 * Min/max in one pass without `Math.min(...arr)`'s call-stack ceiling
 * (~100k arg limit). NaN values are skipped — comparisons against NaN
 * always return false, so they never replace min or max.
 */
export function extent(values: readonly number[]): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return [min, max]
}
