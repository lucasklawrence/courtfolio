/**
 * Supabase-backed store for live panel runs (#241). One table, `panel_runs`,
 * pays double rent:
 *
 * - **Rate-limit ledger** — admission is insert-then-count: the row goes in as
 *   `running` first, then the windows are counted *including self*, so a
 *   concurrent race can only over-count and reject (fail closed — a run is
 *   never executed un-metered). A partial unique index on
 *   `(target_id) WHERE status = 'running'` additionally single-flights each
 *   target: two first visitors can't both trigger a paid run.
 * - **Run cache** — a completed run younger than the TTL is served to
 *   subsequent visitors as a zero-cost replay through the same wire protocol.
 *
 * Every function throws on unexpected DB errors; the route maps a throw to a
 * 503 (fail closed — Supabase down means the paid endpoint is down, never
 * un-metered).
 */
import 'server-only'

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { PanelResult } from '@/lib/panel/types'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

import {
  FAILED_RUN_COOLDOWN_MS,
  GLOBAL_RUNS_PER_DAY,
  PER_IP_RUNS_PER_HOUR,
  RUN_CACHE_TTL_MS,
  STALE_RUNNING_MS,
} from './limits'

/** A stored, completed run served as a zero-cost replay. */
export interface StoredRun {
  /** Row id. */
  id: string
  /** The full stored {@link PanelResult}. */
  result: PanelResult
  /** ISO timestamp of when the run ran (drives the "cached run from …" label). */
  createdAt: string
}

/** Why admission was refused (maps to a 429 at the route). */
export type RunRejection =
  /** Another live run for this target is in flight right now. */
  | { kind: 'in-progress'; retryAfterSeconds: number }
  /** The last run failed recently; cooling down before the next paid attempt. */
  | { kind: 'cooldown'; retryAfterSeconds: number }
  /** This IP spent its hourly budget. */
  | { kind: 'ip-limit'; retryAfterSeconds: number }
  /** The global daily budget is spent. */
  | { kind: 'global-limit'; retryAfterSeconds: number }

/** Outcome of {@link admitLiveRun}: replay a cached run, run live, or refuse. */
export type AdmitOutcome =
  /** A fresh completed run exists — replay it, spend nothing. */
  | { kind: 'cached'; run: StoredRun }
  /** Admitted: a `running` row was inserted; run live under this id. */
  | { kind: 'admitted'; runId: string }
  /** Refused by a guard. */
  | { kind: 'rejected'; rejection: RunRejection }

/**
 * Salted SHA-256 of the client IP for the rate-limit ledger. Raw IPs are
 * enumerable and PII-adjacent, so only the hash is stored. Returns `null`
 * when `PANEL_IP_HASH_SALT` is unset — the caller must fail closed (503),
 * mirroring the `validateApiKey` misconfiguration convention.
 */
export function hashClientIp(ip: string): string | null {
  const salt = process.env.PANEL_IP_HASH_SALT
  if (!salt) {
    console.error('PANEL_IP_HASH_SALT env var not set — live panel endpoint is disabled')
    return null
  }
  return createHash('sha256').update(`${ip}${salt}`).digest('hex')
}

/** Postgres unique-violation code (the single-flight index firing). */
const UNIQUE_VIOLATION = '23505'

/** ISO timestamp `ms` milliseconds ago. */
function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

/**
 * Sweep `running` rows old enough to be crashed functions (a live run always
 * aborts at 120s, so anything past {@link STALE_RUNNING_MS} is an orphan).
 * Without the sweep, one crashed run would hold the single-flight lock — and
 * the whole live feature — closed forever.
 */
async function sweepStaleRunning(supabase: SupabaseClient, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('panel_runs')
    .update({ status: 'failed', error_type: 'StaleRunTimeout', completed_at: new Date().toISOString() })
    .eq('target_id', targetId)
    .eq('status', 'running')
    .lt('created_at', isoAgo(STALE_RUNNING_MS))
  if (error) throw new Error(`panel_runs stale sweep failed: ${error.message}`)
}

/**
 * The newest completed, non-degraded run within the cache TTL, or null. A
 * degraded run (benched personas) is never the shared showcase.
 */
async function findCachedRun(supabase: SupabaseClient, targetId: string): Promise<StoredRun | null> {
  const { data, error } = await supabase
    .from('panel_runs')
    .select('id, result, created_at')
    .eq('target_id', targetId)
    .eq('status', 'completed')
    .eq('persona_failure_count', 0)
    .gte('created_at', isoAgo(RUN_CACHE_TTL_MS))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`panel_runs cache lookup failed: ${error.message}`)
  if (!data || !data.result) return null
  return { id: data.id, result: data.result as PanelResult, createdAt: data.created_at }
}

/**
 * Seconds until the failed-run cooldown lapses, or 0 when no recent failure.
 * Stops a flaky gateway from being retry-stormed into repeated partial-cost
 * runs.
 */
async function failureCooldownSeconds(
  supabase: SupabaseClient,
  targetId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('panel_runs')
    .select('created_at')
    .eq('target_id', targetId)
    .eq('status', 'failed')
    .gte('created_at', isoAgo(FAILED_RUN_COOLDOWN_MS))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`panel_runs cooldown lookup failed: ${error.message}`)
  if (!data) return 0
  const elapsedMs = Date.now() - new Date(data.created_at).getTime()
  return Math.max(1, Math.ceil((FAILED_RUN_COOLDOWN_MS - elapsedMs) / 1000))
}

/**
 * Count real (spend-bearing) runs in a window: `running`, `completed`, and
 * `failed` all consumed model calls; `rejected` rows never spent and are
 * excluded so a burst of refused requests can't lock a well-behaved visitor
 * out further.
 */
async function countRealRuns(
  supabase: SupabaseClient,
  opts: { ipHash?: string; sinceMs: number }
): Promise<number> {
  let query = supabase
    .from('panel_runs')
    .select('id', { count: 'exact', head: true })
    .in('status', ['running', 'completed', 'failed'])
    .gte('created_at', isoAgo(opts.sinceMs))
  if (opts.ipHash !== undefined) query = query.eq('ip_hash', opts.ipHash)
  const { count, error } = await query
  if (error) throw new Error(`panel_runs window count failed: ${error.message}`)
  return count ?? 0
}

/** Mark an admitted row as refused after a post-insert count exceeded a limit. */
async function markRejected(supabase: SupabaseClient, runId: string): Promise<void> {
  const { error } = await supabase
    .from('panel_runs')
    .update({ status: 'rejected', completed_at: new Date().toISOString() })
    .eq('id', runId)
  if (error) throw new Error(`panel_runs reject update failed: ${error.message}`)
}

/**
 * Run the full admission sequence for a live run: sweep stale locks →
 * failure cooldown → cache lookup → single-flight insert → insert-then-count
 * rate limits. See the module doc for why the order and race direction are
 * safe.
 *
 * @param targetId the live target being run
 * @param ipHash salted client-IP hash from {@link hashClientIp}
 * @throws on any unexpected DB error (route maps to 503, fail closed)
 */
export async function admitLiveRun(targetId: string, ipHash: string): Promise<AdmitOutcome> {
  const supabase = createAdminSupabaseClient()

  await sweepStaleRunning(supabase, targetId)

  const cooldown = await failureCooldownSeconds(supabase, targetId)
  if (cooldown > 0) {
    return { kind: 'rejected', rejection: { kind: 'cooldown', retryAfterSeconds: cooldown } }
  }

  const cached = await findCachedRun(supabase, targetId)
  if (cached) return { kind: 'cached', run: cached }

  // Single-flight: the partial unique index allows one `running` row per
  // target; a concurrent second visitor gets a unique violation, not a bill.
  const { data, error } = await supabase
    .from('panel_runs')
    .insert({ target_id: targetId, ip_hash: ipHash, status: 'running' })
    .select('id')
    .single()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        kind: 'rejected',
        rejection: { kind: 'in-progress', retryAfterSeconds: 90 },
      }
    }
    throw new Error(`panel_runs insert failed: ${error.message}`)
  }
  const runId = data.id as string

  // Insert-then-count: both concurrent racers count each other and both
  // reject — worst case slight under-serving, never over-spending.
  const ipCount = await countRealRuns(supabase, { ipHash, sinceMs: 60 * 60 * 1000 })
  if (ipCount > PER_IP_RUNS_PER_HOUR) {
    await markRejected(supabase, runId)
    return {
      kind: 'rejected',
      rejection: { kind: 'ip-limit', retryAfterSeconds: 3600 },
    }
  }

  const globalCount = await countRealRuns(supabase, { sinceMs: 24 * 60 * 60 * 1000 })
  if (globalCount > GLOBAL_RUNS_PER_DAY) {
    await markRejected(supabase, runId)
    return {
      kind: 'rejected',
      rejection: { kind: 'global-limit', retryAfterSeconds: 3600 },
    }
  }

  return { kind: 'admitted', runId }
}

/**
 * Persist a finished run. Degraded runs (benched personas) are stored for the
 * record but excluded from the shared cache by {@link admitLiveRun}'s
 * `persona_failure_count = 0` filter.
 */
export async function markCompleted(
  runId: string,
  result: PanelResult,
  personaFailureCount: number
): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('panel_runs')
    .update({
      status: 'completed',
      result,
      persona_failure_count: personaFailureCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
  if (error) throw new Error(`panel_runs complete update failed: ${error.message}`)
}

/** Record a failed run (starts the {@link FAILED_RUN_COOLDOWN_MS} cooldown). */
export async function markFailed(runId: string, errorType: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('panel_runs')
    .update({ status: 'failed', error_type: errorType, completed_at: new Date().toISOString() })
    .eq('id', runId)
  if (error) throw new Error(`panel_runs failure update failed: ${error.message}`)
}
