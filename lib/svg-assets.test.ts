// @vitest-environment node
/**
 * Integrity guard for the illustrated SVG assets (#201, follow-up to the
 * SVGO optimization in #200).
 *
 * Every file in these directories is a single `<symbol id="…">` consumed
 * externally by `components/common/SvgUse.tsx` as
 * `<use href="/file.svg#SymbolId" />`. `npm run optimize:svg` runs SVGO
 * over them, and a misconfigured plugin can silently strip the symbol —
 * leaving a valid-but-empty `<svg/>` that renders as a blank hole with no
 * error (exactly what `cleanupIds` / `removeHiddenElems` did before they
 * were disabled in `svgo.config.mjs`). This test fails loudly if that
 * regression ever ships, so a bad `optimize:svg` run can't merge.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Asset directories (relative to the repo root, where Vitest runs) whose
 * every `*.svg` must be a non-empty `<symbol>` whose `id` equals the filename
 * (the fragment `SvgUse` references). Mirrors the globs in the `optimize:svg`
 * npm script; keep the two in sync when adding a family.
 */
const SYMBOL_SVG_DIRS = [
  'public/locker-room',
  'public/training-facility',
  'public/contact',
  'public/common',
] as const

/**
 * Size floor (bytes) a real asset clears easily — the smallest today is
 * ~1.3 KB — but a gutted file (the ~40-byte empty `<svg/>`, or an
 * `<symbol/>` emptied of paths) cannot. Paired with the `<symbol>` check
 * below so both whole-element removal and content-only stripping fail.
 */
const MIN_BYTES = 200

/** Recursively collect `*.svg` paths under `dir` (handles the nested
 * `training-facility/equipment/` folder as well as the flat ones). */
function svgFilesIn(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map((entry) => entry.toString())
    .filter((rel) => rel.endsWith('.svg'))
    .map((rel) => join(dir, rel))
}

const files = SYMBOL_SVG_DIRS.flatMap(svgFilesIn)

describe('symbol SVG assets survive optimization (#201)', () => {
  it('discovers the expected asset set', () => {
    // 26 locker-room + 8 training-facility + 2 contact + 1 common = 37.
    // `>=` so adding an asset doesn't require touching this number.
    expect(files.length).toBeGreaterThanOrEqual(37)
  })

  it.each(files)('%s keeps its <symbol id="<filename>"> above the size floor', (file) => {
    // Size floor catches a fully-gutted or path-stripped file...
    expect(statSync(file).size).toBeGreaterThan(MIN_BYTES)

    // ...and the id must still equal the filename, because that's the exact
    // fragment `SvgUse` references (`/<file>.svg#<filename>`). Asserting the
    // value — not just "some <symbol id>" — also catches a renamed/minified id,
    // not only whole-symbol removal.
    const id = basename(file, '.svg')
    const match = readFileSync(file, 'utf8').match(/<symbol\b[^>]*\bid="([^"]+)"/)
    expect(
      match?.[1],
      `${file} must expose <symbol id="${id}"> for its external <use href>`
    ).toBe(id)
  })
})
