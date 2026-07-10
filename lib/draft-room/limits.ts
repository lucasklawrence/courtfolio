/**
 * Every guard number for the live panel run (#241), in one place. The public
 * route is a paid endpoint strangers can trigger, so each constant here is a
 * cost brake — see `app/api/panel/run/route.ts` for the enforcement order and
 * `docs` in each comment for why the number is what it is.
 *
 * Worst-case spend with these numbers: 3×2,000 + 12×600 + 4,000 ≈ 17k output
 * tokens + ~50k input tokens per run ≈ $0.05–0.15 on the configured tiers,
 * ×{@link GLOBAL_RUNS_PER_DAY} ≈ a few dollars/day ceiling — beneath the hard
 * AI Gateway spend cap set in the Vercel dashboard (the final backstop).
 */
import type { StageLimits } from '@/lib/panel/types'

/**
 * Per-stage output-token ceilings for the live run. Real persona verdicts run
 * ~300–400 output tokens; the headroom absorbs schema-retry worst cases, not
 * bigger essays. The meta-judge object is the largest (its scoreboard is
 * deterministic and not model-produced, so 4k is generous).
 */
export const PANEL_STAGE_LIMITS: StageLimits = {
  personaMaxOutputTokens: 2_000,
  verifierMaxOutputTokens: 600,
  metaJudgeMaxOutputTokens: 4_000,
}

/** Real runs allowed per IP (salted hash) per rolling hour. */
export const PER_IP_RUNS_PER_HOUR = 2

/** Real runs allowed globally per rolling 24 hours — the daily cost ceiling. */
export const GLOBAL_RUNS_PER_DAY = 25

/**
 * How long a completed run is served to subsequent visitors as a zero-cost
 * replay instead of triggering a new paid run. One hour (not 24) so real
 * streaming runs actually happen throughout the day — a longer TTL would make
 * the streaming feature invisible in practice while saving pennies.
 */
export const RUN_CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Wall-clock abort for a live run. Typical full runs finish in 30–60s; at 120s
 * something is wedged and every in-flight model call gets cancelled.
 */
export const RUN_TIMEOUT_MS = 120_000

/**
 * Cooldown after a failed run before the next paid attempt. Stops a flaky
 * gateway from being retry-stormed into repeated partial-cost runs.
 */
export const FAILED_RUN_COOLDOWN_MS = 5 * 60 * 1000

/**
 * Age at which a `running` row is presumed crashed and swept to `failed`.
 * Must exceed {@link RUN_TIMEOUT_MS}: a live run can never legitimately be
 * `running` longer than its abort.
 */
export const STALE_RUNNING_MS = 5 * 60 * 1000

/**
 * Interval between `ping` frames on the NDJSON stream, keeping proxies from
 * idling out the connection during quiet stages (verify/synthesis waits).
 */
export const HEARTBEAT_INTERVAL_MS = 10_000

/**
 * Minimum surviving persona verdicts for a public run. One surviving model is
 * an opinion, not a panel — below two, the run fails rather than shipping a
 * single-vendor verdict under a "panel" label.
 */
export const MIN_SURVIVORS = 2
