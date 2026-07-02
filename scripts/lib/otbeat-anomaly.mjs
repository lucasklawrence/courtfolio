/**
 * Auto-detection of anomalous OrangeTheory sessions (#268).
 *
 * Some "sessions" aren't real workouts — e.g. an equipment malfunction where
 * the OTbeat belt logs a class with near-zero output and no treadmill or rower
 * block (the 05/30/2026 Jacob Buckenmeyer class: 4 calories, 0 splat, no
 * machine data). Those should be kept in the table (never deleted) but flagged
 * `excluded` so the OTF view leaves them out of every aggregate and chart.
 *
 * This module is the single source of truth for the heuristic. It is:
 * - called from `recordToRow` (`otbeat-supabase.mjs`) so newly-ingested
 *   anomalies are flagged at first insert, and
 * - mirrored by the backfill `UPDATE` in
 *   `supabase/migrations/20260702120000_otf_sessions_excluded.sql` for the rows
 *   that predate this feature.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step, same
 * constraint as the sibling parser / supabase helpers.
 *
 * KEEP THE THRESHOLDS IN SYNC WITH the migration's backfill `WHERE` clause.
 */

/** Reason string stamped on auto-detected anomalies. Mirrored in the migration backfill. */
export const AUTO_EXCLUDE_REASON =
  'auto: near-zero output with no treadmill or rower block (likely equipment malfunction)'

/** A session with fewer calories than this (and no machine block) is treated as non-real. */
const MAX_ANOMALY_CALORIES = 25

/** A session with more splat points than this is never auto-excluded, regardless of the rest. */
const MAX_ANOMALY_SPLAT = 1

/**
 * The signals the anomaly heuristic reads off a session, normalized so the same
 * classifier serves the parsed-record ingest path and any row-shaped caller.
 * @typedef {Object} OtfAnomalySignals
 * @property {number|null|undefined} calories Calories burned, or absent.
 * @property {number|null|undefined} splat Splat points, or absent.
 * @property {boolean} hasTreadmill Whether a treadmill performance block is present.
 * @property {boolean} hasRower Whether a rower performance block is present.
 */

/**
 * Classify a session as a likely equipment-malfunction anomaly.
 *
 * A real OrangeTheory class always logs at least one machine block (treadmill
 * or rower) and burns hundreds of calories — the lowest legitimate class in the
 * dataset is 541 cal with both blocks present. So the conjunction of *no*
 * machine block **and** near-zero calories **and** ~zero splat is a strong,
 * false-positive-resistant signal that the belt malfunctioned rather than that
 * a genuine low-intensity class happened.
 *
 * Conservative by design: a real class that merely omits the rower (tread-only
 * formats) still has a treadmill block and hundreds of calories, so it never
 * trips this. Widen the thresholds only if a genuine anomaly slips through.
 *
 * @param {OtfAnomalySignals} signals Normalized session signals.
 * @returns {{ excluded: boolean, reason: string | null }} `excluded: true` with
 *   a {@link AUTO_EXCLUDE_REASON} reason when the session looks anomalous;
 *   `{ excluded: false, reason: null }` otherwise.
 */
export function classifyOtfAnomaly({ calories, splat, hasTreadmill, hasRower }) {
  const noMachineBlock = !hasTreadmill && !hasRower
  const nearZeroOutput = (calories ?? 0) < MAX_ANOMALY_CALORIES && (splat ?? 0) <= MAX_ANOMALY_SPLAT
  if (noMachineBlock && nearZeroOutput) {
    return { excluded: true, reason: AUTO_EXCLUDE_REASON }
  }
  return { excluded: false, reason: null }
}
