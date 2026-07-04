/**
 * Coarse class-type inference for OrangeTheory sessions (#271).
 *
 * The OTbeat "Studio Workout Summary" email carries **no** class-type token —
 * nowhere does it say "2G", "3G", "Strength 50", "Tread 50", etc. (verified
 * against the full flattened body). So we can't parse the studio's official
 * format name. Instead we infer a *coarse, honest* label from which machine
 * blocks the class logged and how the tread/rower time splits — enough to
 * filter the OTF stats by rough format without pretending to know OTF's own
 * template name.
 *
 * Two-column design in `otf_sessions` (mirrors the #268 excluded pattern):
 * - `class_type` — this auto-inferred coarse label, written at ingest.
 * - `class_type_override` — a nullable manual column set in Supabase to the
 *   *real* format name ("2G", "Strength 50", …) when known. The effective type
 *   the view uses is `override ?? class_type` (see `effectiveOtfClassType` in
 *   `lib/training-facility/otf.ts`).
 *
 * Because {@link import('./otbeat-supabase.mjs').upsertOtfSessions} is
 * append-only (`ignoreDuplicates` → ON CONFLICT DO NOTHING), `class_type` is
 * only ever written on a row's *first* insert, so a later manual override is
 * never clobbered by a re-pull — the same property that lets #268's `excluded`
 * auto-flag and manual edits coexist.
 *
 * This module is the single source of truth for the auto labels. It is:
 * - called from `recordToRow` (`otbeat-supabase.mjs`) so newly-ingested
 *   sessions get a `class_type` at first insert, and
 * - mirrored by the backfill `UPDATE` in
 *   `supabase/migrations/<ts>_otf_sessions_class_type.sql` for rows that
 *   predate this feature.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step, same
 * constraint as the sibling parser / supabase / anomaly helpers.
 *
 * KEEP THE LABEL STRINGS IN SYNC WITH: the migration backfill's `CASE`
 * expression and `OTF_CLASS_TYPE_ORDER` in `lib/training-facility/otf.ts`
 * (guarded by a drift test in `lib/training-facility/otf.test.ts`).
 */

/** Both a treadmill and a rower block, with the tread time ≥ the rower time. */
export const OTF_CLASS_TYPE_BOTH = 'Tread + Row'

/** A treadmill block but no rower block (tread-only formats). */
export const OTF_CLASS_TYPE_TREAD = 'Tread-focused'

/**
 * A rower block that dominates — either no treadmill at all, or the rower time
 * exceeds the tread time (a row-heavy class).
 */
export const OTF_CLASS_TYPE_ROW = 'Row-focused'

/** No machine block at all but real output — a strength / floor-only day. */
export const OTF_CLASS_TYPE_STRENGTH = 'Strength / Floor'

/**
 * Minimum calories for a machine-less session to read as a real strength/floor
 * class rather than a near-zero belt malfunction (which stays `null`). Well
 * above the #268 anomaly ceiling (25 cal) so the two thresholds don't fight: a
 * malfunction is both `excluded` (calories < 25) and `class_type = null`.
 */
const MIN_STRENGTH_CALORIES = 100

/**
 * The signals the class-type heuristic reads off a session, normalized so the
 * same classifier serves the parsed-record ingest path and any row-shaped
 * caller. Durations are in whole seconds (0 / absent → treated as 0).
 * @typedef {Object} OtfClassTypeSignals
 * @property {boolean} hasTreadmill Whether a treadmill performance block is present.
 * @property {boolean} hasRower Whether a rower performance block is present.
 * @property {number|null|undefined} [treadSec] Total treadmill time, seconds.
 * @property {number|null|undefined} [rowerSec] Total rower time, seconds.
 * @property {number|null|undefined} [calories] Calories burned, or absent.
 */

/**
 * Infer a coarse class-type label from a session's machine signature.
 *
 * Rules (first match wins):
 * 1. No treadmill **and** no rower → {@link OTF_CLASS_TYPE_STRENGTH} when
 *    calories ≥ {@link MIN_STRENGTH_CALORIES}, else `null` (the belt-malfunction
 *    sentinel — already `excluded` by #268, so it never reaches an aggregate).
 * 2. Treadmill only → {@link OTF_CLASS_TYPE_TREAD}.
 * 3. Rower only → {@link OTF_CLASS_TYPE_ROW}.
 * 4. Both → {@link OTF_CLASS_TYPE_ROW} when the rower time exceeds the tread
 *    time (a row-heavy class), otherwise {@link OTF_CLASS_TYPE_BOTH}.
 *
 * Deliberately coarse: it names which machines were worked, not OTF's official
 * 2G/3G/Strength template — use `class_type_override` for that. Kept
 * false-positive-resistant so a normal class never lands on `null`.
 *
 * @param {OtfClassTypeSignals} signals Normalized session signals.
 * @returns {string|null} A coarse class-type label, or `null` when the session
 *   has no machine block and near-zero output.
 */
export function classifyOtfClassType({ hasTreadmill, hasRower, treadSec, rowerSec, calories }) {
  if (!hasTreadmill && !hasRower) {
    return (calories ?? 0) >= MIN_STRENGTH_CALORIES ? OTF_CLASS_TYPE_STRENGTH : null
  }
  if (hasTreadmill && !hasRower) return OTF_CLASS_TYPE_TREAD
  if (!hasTreadmill && hasRower) return OTF_CLASS_TYPE_ROW
  return (rowerSec ?? 0) > (treadSec ?? 0) ? OTF_CLASS_TYPE_ROW : OTF_CLASS_TYPE_BOTH
}
