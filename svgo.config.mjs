/**
 * SVGO configuration for `npm run optimize:svg` (#195).
 *
 * Every illustrated asset under `public/locker-room/` and
 * `public/training-facility/` is a single `<symbol id="…">` wrapper that
 * the app renders through `components/common/SvgUse.tsx` as
 * `<use href="/file.svg#SymbolId" />`. That external fragment reference
 * is the load-bearing contract this config must not break:
 *
 *   - `cleanupIds` is OFF — the symbol `id` is referenced from *outside*
 *     the file, so SVGO sees it as unused and would strip/minify it,
 *     breaking every `<use>`.
 *   - `removeHiddenElems` is OFF — a top-level `<symbol>` with no `<use>`
 *     *inside the same file* is treated as hidden/dead and deleted,
 *     gutting the asset to an empty `<svg/>`. Our `<use>` lives in the
 *     React tree, not the file, so this plugin must not run.
 *
 * (`removeViewBox` is not part of preset-default in SVGO v4, so the
 * symbol's `viewBox` — which drives `<use width/height>` scaling — is
 * preserved without an explicit override.)
 *
 * `floatPrecision: 3` is the chosen "zero visible change" baseline:
 * benchmarking showed the bulk of the win comes from lossless
 * whitespace/metadata stripping and path-data reformatting, with
 * precision 3 leaving no perceptible diff at 1x or 2x on the largest
 * (YogaMat) and most detailed (Laptop) assets. Lower precision (1–2)
 * shaved only a few extra percent while visibly softening fine traced
 * detail, so it was rejected per the issue's fidelity-first decision.
 *
 * @see https://svgo.dev/docs/preset-default/
 */

/** @type {import('svgo').Config} */
export default {
  // Re-run plugins until the output stabilizes — squeezes out the last
  // few percent on these many-path files at negligible build-time cost.
  multipass: true,
  // Coordinate precision for convertPathData / cleanupNumericValues etc.
  // 3 decimals is visually lossless on the traced illustrations here.
  floatPrecision: 3,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          removeHiddenElems: false,
        },
      },
    },
  ],
}
