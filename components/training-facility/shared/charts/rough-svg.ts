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

/**
 * Convert a rough.js Drawable into plain SVG path data. Keeps render
 * declarative — callers map these into `<path>` elements directly.
 */
export function drawableToPaths(drawable: Drawable): DrawablePath[] {
  return getGenerator().toPaths(drawable)
}
