/**
 * POST /api/panel/run — the live judge-panel stream (#241).
 *
 * The one paid, public endpoint in the repo: a visitor triggers a real
 * cross-family panel run against the fixed server-side thesis + committed
 * baked evidence (Mode A — the body only *selects* a registered target, no
 * visitor text ever reaches a prompt). The response is NDJSON — one
 * {@link LivePanelEvent} JSON object per line — streaming persona verdicts as
 * each model call settles, per-gap verifier rulings, then the synthesis.
 *
 * Guard order (every guard fails closed):
 *  1. feature flag off → 404 (endpoint doesn't exist until launch)
 *  2. cross-origin POST → 403 (sheds trivial scripted bursts)
 *  3. invalid body / unknown target → 400
 *  4. stub seam (non-production + `PANEL_LIVE_STUB=1`) → streamed stub replay
 *  5. missing IP salt or Supabase failure → 503 (never run un-metered)
 *  6. admission: failure cooldown / cache replay / single-flight /
 *     insert-then-count per-IP + global limits → 429 with `Retry-After`
 *
 * Transport rationale: POST + NDJSON, not `EventSource`/SSE — EventSource is
 * GET-only, and a GET that spends money is prefetch/crawler-triggerable; a
 * fetch-reader is required either way, and NDJSON needs no `data:` framing.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z, ZodError } from 'zod'

import { isPanelLiveEnabled } from '@/lib/feature-flags'
import { runPanel, PanelDegradedError } from '@/lib/panel'
import { errorTypeOf } from '@/lib/panel/events'
import type { PanelEvent, PanelResult } from '@/lib/panel/types'
import {
  HEARTBEAT_INTERVAL_MS,
  MIN_SURVIVORS,
  RUN_TIMEOUT_MS,
} from '@/lib/draft-room/limits'
import {
  lensByPersonaId,
  LIVE_TARGETS,
  modelByPersonaId,
} from '@/lib/draft-room/live-target'
import { resultToEvents, type LivePanelEvent } from '@/lib/draft-room/protocol'
import {
  admitLiveRun,
  hashClientIp,
  markCompleted,
  markFailed,
} from '@/lib/draft-room/run-store'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'
import { courtfolioPanelResult } from '@/app/draft-room/panelResult'

/**
 * Allow the stream the full Fluid Compute window. The in-run 120s abort
 * ({@link RUN_TIMEOUT_MS}) is the real brake; this only keeps the platform
 * from killing a healthy stream early.
 */
export const maxDuration = 300

/** Request body: selects a registered live target — carries no free text. */
const RunRequestSchema = z.object({
  /** Key into the server-side {@link LIVE_TARGETS} registry. */
  targetId: z.string().min(1).max(64),
})

/** Pacing (ms before an event) for replayed streams, so a cached run reads as a reveal, not a dump. */
const REPLAY_PACE_MS: Partial<Record<LivePanelEvent['type'], number>> = {
  'persona-verdict': 300,
  synthesis: 400,
}

/** Resolve after `ms` (0 resolves immediately without a timer). */
function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, ms))
}

/** Encode one event as an NDJSON line. */
function toLine(event: LivePanelEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

/** Shared headers for every NDJSON stream response. */
const STREAM_HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store',
} as const

/**
 * Stream a fixed event list (cache-hit replay or stub) with light pacing.
 * Replays through the same protocol a live run uses — by construction, not
 * convention: {@link resultToEvents} is the only sequence source.
 */
function streamReplay(events: LivePanelEvent[], paceScale: number): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        await sleep((REPLAY_PACE_MS[event.type] ?? 0) * paceScale)
        controller.enqueue(toLine(event))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: STREAM_HEADERS })
}

/**
 * Stub-mode only: give every verdict gap a verifier ruling. A real run's
 * `verifiedGaps` always covers every gap (that's the verify stage's
 * contract), but the hand-authored replay recorded only the two refuted
 * rulings — so without this, a stubbed stream would never land a ruling
 * badge on any card and e2e couldn't exercise that surface. Surviving gaps
 * are reconstructed as `upheld` (they survived the strip, which removes only
 * refuted gaps) with a note that says exactly what this is.
 */
function withReconstructedRulings(result: PanelResult): PanelResult {
  const recorded = new Set(result.verifiedGaps.map(g => `${g.personaId}|${g.gapIndex}`))
  const reconstructed = result.verdicts.flatMap(v =>
    v.gaps.flatMap((gap, gapIndex) =>
      recorded.has(`${v.personaId}|${gapIndex}`)
        ? []
        : [
            {
              ...gap,
              personaId: v.personaId,
              gapIndex,
              verdict: 'upheld' as const,
              verifyNote:
                'Survived the fact-check (stub reconstruction — the stored replay records only the refuted rulings).',
            },
          ]
    )
  )
  return { ...result, verifiedGaps: [...reconstructed, ...result.verifiedGaps] }
}

/**
 * Which pipeline stage a live-run failure happened in, from the events seen
 * so far — gives the client an honest "where it died" without error text.
 */
function failureStage(seen: {
  verifyStarted: boolean
  gapsVerified: boolean
}): 'personas' | 'verify' | 'synthesis' {
  if (!seen.verifyStarted) return 'personas'
  if (!seen.gapsVerified) return 'verify'
  return 'synthesis'
}

/**
 * Classify a live-run failure for the `run-error` frame and the ledger.
 * Cancellations are normalized (`TimeoutError` for the 120s brake,
 * `AbortError` for a client walking away — the store exempts the latter from
 * the failure cooldown); everything else reports its constructor name only.
 */
function classifyRunError(err: unknown, abortSignal: AbortSignal): string {
  if (err instanceof PanelDegradedError) return 'PanelDegradedError'
  const name = errorTypeOf(err)
  if (name === 'TimeoutError') return 'TimeoutError'
  if (name === 'AbortError' || abortSignal.aborted) {
    // Distinguish "the 120s brake fired" from "the client disconnected" by
    // the abort reason — both surface as cancellations mid-pipeline.
    return errorTypeOf(abortSignal.reason) === 'TimeoutError' ? 'TimeoutError' : 'AbortError'
  }
  return name
}

/** Run the live pipeline and stream every event as it settles. */
function streamLiveRun(
  target: (typeof LIVE_TARGETS)[string],
  runId: string,
  request: NextRequest
): Response {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()

  // One controller for the whole run: the 120s wall-clock brake and a client
  // disconnect both cancel every in-flight model call immediately. An
  // already-aborted request signal never fires its listener, so check it
  // directly — a client that vanished during admission must not fund a full
  // run nobody is reading.
  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(new DOMException('Run timed out.', 'TimeoutError')), RUN_TIMEOUT_MS)
  if (request.signal.aborted) {
    abort.abort(request.signal.reason)
  } else {
    request.signal.addEventListener('abort', () => abort.abort(request.signal.reason), {
      once: true,
    })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Safe writer: after a terminal frame (or client disconnect) the
      // controller is closed and further writes are silently dropped.
      let closed = false
      const write = (event: LivePanelEvent) => {
        if (closed) return
        try {
          controller.enqueue(toLine(event))
        } catch {
          closed = true
        }
      }

      const heartbeat = setInterval(() => write({ type: 'ping' }), HEARTBEAT_INTERVAL_MS)
      const seen = { verifyStarted: false, gapsVerified: false }

      write({
        type: 'run-start',
        targetId: target.thesis.targetId,
        thesis: target.thesis,
        personas: target.config.personas.map(p => ({
          id: p.id,
          label: p.label,
          lens: p.lens,
          model: target.config.lineup.personas[p.family],
        })),
        cached: false,
        startedAt,
      })

      try {
        const result = await runPanel(target.thesis, target.evidence, target.config, {
          signal: abort.signal,
          minSurvivors: MIN_SURVIVORS,
          onEvent: (event: PanelEvent) => {
            if (event.type === 'verify-start') seen.verifyStarted = true
            if (event.type === 'gaps-verified') seen.gapsVerified = true
            write(event)
          },
        })

        write({ type: 'synthesis', synthesis: result.synthesis })
        write({ type: 'done', elapsedMs: Date.now() - startedMs })
        // Best-effort bookkeeping AFTER the terminal frame: a store blip here
        // must not turn a delivered run into a run-error (the only cost is
        // this run not populating the shared cache).
        const degradationCount =
          (result.personaFailures?.length ?? 0) +
          result.verifiedGaps.filter(g => g.verifierFailed).length
        await markCompleted(runId, result, degradationCount).catch(err =>
          console.error('panel run completion bookkeeping failed:', err instanceof Error ? err.message : err)
        )
      } catch (err) {
        const errorType = classifyRunError(err, abort.signal)
        write({ type: 'run-error', stage: failureStage(seen), errorType })
        // Best-effort bookkeeping: the stream outcome was already delivered.
        // AbortError rows are exempted from the failure cooldown in the store
        // — a visitor walking away says nothing about gateway health.
        await markFailed(runId, errorType).catch(() => undefined)
      } finally {
        clearInterval(heartbeat)
        clearTimeout(timeout)
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
    cancel() {
      // Client walked away: stop paying for the run immediately.
      abort.abort(new DOMException('Client disconnected.', 'AbortError'))
    },
  })

  return new Response(stream, { status: 200, headers: STREAM_HEADERS })
}

/** POST /api/panel/run — see the module doc for the full guard order. */
async function handlePOST(request: NextRequest): Promise<Response> {
  // 1. Dark until launch: without the flag this endpoint does not exist.
  if (!isPanelLiveEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  // 2. Same-origin only. Browsers always send Origin on cross-site POSTs, so
  // a mismatch is a scripted burst; requests without Origin (curl, tests)
  // pass — the real guards are admission control, this just sheds noise.
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 })
    }
  }

  // 3. Body selects a registered target — nothing free-form.
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }
  let targetId: string
  try {
    targetId = RunRequestSchema.parse(payload).targetId
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed.', issues: err.flatten() },
        { status: 400 }
      )
    }
    throw err
  }
  const target = LIVE_TARGETS[targetId]
  if (!target) {
    return NextResponse.json({ error: `Unknown target: ${targetId}` }, { status: 400 })
  }

  // 4. Stub seam for e2e/dev — mirrors the TELEMETRY_DISABLED env-var
  // pattern, production-gated so a leaked env var can never serve fabricated
  // "live" runs on the real site. Streams via the same resultToEvents used by
  // the cache-hit path, so the stub cannot drift from the wire protocol.
  if (process.env.NODE_ENV !== 'production' && process.env.PANEL_LIVE_STUB === '1') {
    return streamReplay(
      resultToEvents(withReconstructedRulings(courtfolioPanelResult), {
        cached: false,
        startedAt: new Date().toISOString(),
        modelByPersonaId: modelByPersonaId(target.config),
        lensByPersonaId: lensByPersonaId(target.config),
      }),
      0.2
    )
  }

  // 5. Metering identity. Missing salt fails closed: no hash, no spend.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = hashClientIp(ip)
  if (!ipHash) {
    return NextResponse.json({ error: 'Live runs are unavailable.' }, { status: 503 })
  }

  // 6. Admission: cooldown → cache → single-flight → windows. Any store
  // error is a 503 — the endpoint never runs un-metered.
  let outcome: Awaited<ReturnType<typeof admitLiveRun>>
  try {
    outcome = await admitLiveRun(targetId, ipHash)
  } catch (err) {
    console.error('panel run admission failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Live runs are unavailable.' }, { status: 503 })
  }

  if (outcome.kind === 'rejected') {
    const { rejection } = outcome
    return NextResponse.json(
      {
        error:
          rejection.kind === 'in-progress'
            ? 'A live run is already in progress — it will be shared here shortly.'
            : 'The panel has hit its run budget — showing the most recent result instead.',
        reason: rejection.kind,
        retryAfterSeconds: rejection.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(rejection.retryAfterSeconds) } }
    )
  }

  if (outcome.kind === 'cached') {
    return streamReplay(
      resultToEvents(outcome.run.result as PanelResult, {
        cached: true,
        startedAt: outcome.run.createdAt,
        modelByPersonaId: modelByPersonaId(target.config),
        lensByPersonaId: lensByPersonaId(target.config),
      }),
      1
    )
  }

  return streamLiveRun(target, outcome.runId, request)
}

/**
 * Telemetry note: for a streamed response the wrapper records time-to-first-
 * byte, not full stream duration — the stream's own `done.elapsedMs` carries
 * the run time.
 */
export const POST = withTelemetry('POST /api/panel/run', handlePOST)
