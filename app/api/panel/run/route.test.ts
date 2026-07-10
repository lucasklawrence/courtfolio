import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NextRequest } from 'next/server'
import type {
  MetaSynthesis,
  PanelResult,
  PanelRunOptions,
  PersonaVerdict,
  VerifiedGap,
} from '@/lib/panel/types'

/**
 * Tests the live judge-panel run endpoint (#241).
 * Validates the guard order (flag → origin → body → stub seam → salt →
 * admission), the 429 rejection contract, and the NDJSON stream shape for
 * stub replays, cached replays, live runs, and live-run failures.
 */

const runPanelMock = vi.fn()

vi.mock('@/lib/panel', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/panel')>()),
  runPanel: (...args: unknown[]) => runPanelMock(...args),
}))

const admitLiveRunMock = vi.fn()
const hashClientIpMock = vi.fn()
const markCompletedMock = vi.fn()
const markFailedMock = vi.fn()

vi.mock('@/lib/draft-room/run-store', () => ({
  admitLiveRun: (...args: unknown[]) => admitLiveRunMock(...args),
  hashClientIp: (...args: unknown[]) => hashClientIpMock(...args),
  markCompleted: (...args: unknown[]) => markCompletedMock(...args),
  markFailed: (...args: unknown[]) => markFailedMock(...args),
}))

const { POST, maxDuration } = await import('./route')
const { PanelDegradedError } = await import('@/lib/panel')

/** One parsed NDJSON frame; loose-typed so tests can reach into any variant. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only wire frame: NDJSON events are a heterogeneous union and assertions reach into variant-specific fields without narrowing
type WireEvent = { type: string } & Record<string, any>

/** Build a POST request to the route. Same-origin by default (host set, no origin). */
function postRun(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/panel/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3000', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** Drain a streamed NDJSON response and parse every non-empty line. */
async function readEvents(res: Response): Promise<WireEvent[]> {
  const text = await res.text()
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as WireEvent)
}

// --- Hand-built fixture PanelResult (minimal but contract-complete) ---

const fixtureVerdict: PersonaVerdict = {
  personaId: 'hiring-manager',
  label: 'Skeptical Hiring Manager',
  scores: [{ axisId: 'learning-value', score: 7, rationale: 'Real engineering under the theme.' }],
  gaps: [
    {
      claimIndex: 0,
      claim: 'The site stands out.',
      artifactShows: 'The gimmick-portfolio genre is crowded.',
      citation: 'components/court/TunnelHero.tsx',
      confidence: 0.7,
    },
  ],
  uncomfortableTruth: 'The theme buries the signal.',
}

const fixtureGap: VerifiedGap = {
  ...fixtureVerdict.gaps[0],
  personaId: 'hiring-manager',
  gapIndex: 0,
  verdict: 'upheld',
  verifyNote: 'The cited file backs the claim.',
}

const fixtureSynthesis: MetaSynthesis = {
  targetId: 'courtfolio',
  scoreboard: [
    { personaId: 'hiring-manager', label: 'Skeptical Hiring Manager', scores: fixtureVerdict.scores },
  ],
  convergence: [],
  disagreements: [],
  robustFindings: ['Lead with the strongest room.'],
  topMoves: ['Surface the engineering earlier.'],
  caughtErrors: [],
  verdict: 'Strong craft, uneven first impression.',
}

const fixtureResult: PanelResult = {
  thesis: { targetId: 'courtfolio', claims: ['claim one', 'claim two', 'claim three'] },
  verdicts: [fixtureVerdict],
  verifiedGaps: [fixtureGap],
  synthesis: fixtureSynthesis,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_ENABLE_PANEL_LIVE', 'true')
  vi.stubEnv('PANEL_LIVE_STUB', '')
  // Defaults: a fully-admitted live run that succeeds immediately.
  hashClientIpMock.mockReturnValue('ip-hash-abc')
  admitLiveRunMock.mockResolvedValue({ kind: 'admitted', runId: 'run-42' })
  markCompletedMock.mockResolvedValue(undefined)
  markFailedMock.mockResolvedValue(undefined)
  runPanelMock.mockResolvedValue(fixtureResult)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/panel/run', () => {
  it('exports maxDuration 300 for the streaming window', () => {
    expect(maxDuration).toBe(300)
  })

  it('returns 404 when the live-panel flag is off, before any metering', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PANEL_LIVE', '')
    const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found.' })
    expect(hashClientIpMock).not.toHaveBeenCalled()
    expect(admitLiveRunMock).not.toHaveBeenCalled()
  })

  describe('origin guard', () => {
    it('returns 403 on a cross-origin POST', async () => {
      const res = await POST(
        postRun({ targetId: 'courtfolio' }, { origin: 'https://evil.example' }) as NextRequest
      )
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Cross-origin requests are not allowed.' })
      expect(admitLiveRunMock).not.toHaveBeenCalled()
    })

    it('returns 403 on a malformed Origin header', async () => {
      const res = await POST(postRun({ targetId: 'courtfolio' }, { origin: 'not a url' }) as NextRequest)
      expect(res.status).toBe(403)
      expect(admitLiveRunMock).not.toHaveBeenCalled()
    })

    it('proceeds when the Origin matches the host', async () => {
      const res = await POST(
        postRun({ targetId: 'courtfolio' }, { origin: 'http://localhost:3000' }) as NextRequest
      )
      expect(res.status).toBe(200)
      await res.text()
      expect(admitLiveRunMock).toHaveBeenCalled()
    })

    it('proceeds when no Origin header is present', async () => {
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(200)
      await res.text()
      expect(admitLiveRunMock).toHaveBeenCalled()
    })
  })

  describe('body validation', () => {
    it('returns 400 when the body is not valid JSON', async () => {
      const res = await POST(postRun('not valid json {') as NextRequest)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Body must be valid JSON.' })
      expect(admitLiveRunMock).not.toHaveBeenCalled()
    })

    it('returns 400 with issues when targetId is missing', async () => {
      const res = await POST(postRun({}) as NextRequest)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Validation failed.')
      expect(body.issues).toBeDefined()
      expect(admitLiveRunMock).not.toHaveBeenCalled()
    })

    it('returns 400 for a targetId not in the registry', async () => {
      const res = await POST(postRun({ targetId: 'nope' }) as NextRequest)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Unknown target: nope' })
      expect(admitLiveRunMock).not.toHaveBeenCalled()
    })
  })

  describe('stub seam', () => {
    it('streams the stub replay without metering when PANEL_LIVE_STUB=1 outside production', async () => {
      vi.stubEnv('PANEL_LIVE_STUB', '1')
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8')

      const events = await readEvents(res)
      const start = events[0]
      expect(start.type).toBe('run-start')
      expect(start.cached).toBe(false)
      expect(start.personas.length).toBeGreaterThan(0)
      for (const persona of start.personas) {
        expect(typeof persona.model).toBe('string')
        expect(persona.model.length).toBeGreaterThan(0)
      }
      expect(events.filter(e => e.type === 'persona-verdict')).toHaveLength(3)
      expect(events.filter(e => e.type === 'gap-verified').length).toBeGreaterThanOrEqual(1)
      expect(events.filter(e => e.type === 'synthesis')).toHaveLength(1)
      expect(events[events.length - 1].type).toBe('done')

      // The stub short-circuits before the metering stack.
      expect(hashClientIpMock).not.toHaveBeenCalled()
      expect(admitLiveRunMock).not.toHaveBeenCalled()
      expect(runPanelMock).not.toHaveBeenCalled()
    })
  })

  describe('metering guards', () => {
    it('returns 503 when the IP salt is unavailable (hashClientIp → null)', async () => {
      hashClientIpMock.mockReturnValue(null)
      const res = await POST(
        postRun({ targetId: 'courtfolio' }, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }) as NextRequest
      )
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'Live runs are unavailable.' })
      // Only the first hop of x-forwarded-for identifies the client.
      expect(hashClientIpMock).toHaveBeenCalledWith('1.2.3.4')
      expect(admitLiveRunMock).not.toHaveBeenCalled()
    })

    it('meters as "unknown" when no x-forwarded-for header exists', async () => {
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(200)
      await res.text()
      expect(hashClientIpMock).toHaveBeenCalledWith('unknown')
      expect(admitLiveRunMock).toHaveBeenCalledWith('courtfolio', 'ip-hash-abc')
    })

    it('returns 503 when the admission store throws', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      admitLiveRunMock.mockRejectedValue(new Error('supabase down'))
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'Live runs are unavailable.' })
      expect(runPanelMock).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('returns 429 with Retry-After for an ip-limit rejection', async () => {
      admitLiveRunMock.mockResolvedValue({
        kind: 'rejected',
        rejection: { kind: 'ip-limit', retryAfterSeconds: 3600 },
      })
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(429)
      expect(res.headers.get('retry-after')).toBe('3600')
      const body = await res.json()
      expect(body.reason).toBe('ip-limit')
      expect(body.retryAfterSeconds).toBe(3600)
      expect(body.error).toBe(
        'The panel has hit its run budget — showing the most recent result instead.'
      )
      expect(runPanelMock).not.toHaveBeenCalled()
    })

    it('returns 429 with the distinct in-progress message for a single-flight rejection', async () => {
      admitLiveRunMock.mockResolvedValue({
        kind: 'rejected',
        rejection: { kind: 'in-progress', retryAfterSeconds: 90 },
      })
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(429)
      expect(res.headers.get('retry-after')).toBe('90')
      const body = await res.json()
      expect(body.reason).toBe('in-progress')
      expect(body.error).toBe(
        'A live run is already in progress — it will be shared here shortly.'
      )
      expect(runPanelMock).not.toHaveBeenCalled()
    })
  })

  describe('cached replay', () => {
    it('replays a cached run with cached:true and the original start time', async () => {
      const createdAt = '2026-07-09T12:00:00.000Z'
      admitLiveRunMock.mockResolvedValue({
        kind: 'cached',
        run: { id: 'run-7', result: fixtureResult, createdAt },
      })
      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8')

      const events = await readEvents(res)
      const start = events[0]
      expect(start.type).toBe('run-start')
      expect(start.cached).toBe(true)
      expect(start.startedAt).toBe(createdAt)
      expect(events.filter(e => e.type === 'persona-verdict')).toHaveLength(1)
      expect(events.filter(e => e.type === 'synthesis')).toHaveLength(1)
      // Replays carry elapsedMs 0 — no new spend happened.
      expect(events[events.length - 1]).toEqual({ type: 'done', elapsedMs: 0 })
      expect(runPanelMock).not.toHaveBeenCalled()
      expect(markCompletedMock).not.toHaveBeenCalled()
    })
  })

  describe('live run', () => {
    it('streams run-start → forwarded engine events → synthesis → done and records completion', async () => {
      runPanelMock.mockImplementation(async (...args: unknown[]) => {
        const opts = args[3] as PanelRunOptions
        opts.onEvent?.({ type: 'persona-verdict', verdict: fixtureVerdict })
        return fixtureResult
      })

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8')

      const events = await readEvents(res)
      const start = events[0]
      expect(start.type).toBe('run-start')
      expect(start.cached).toBe(false)
      expect(start.targetId).toBe('courtfolio')
      expect(typeof start.startedAt).toBe('string')
      // Roster comes from the config (all personas, pre-verdict), with model chips.
      expect(start.personas).toHaveLength(3)
      for (const persona of start.personas) {
        expect(typeof persona.model).toBe('string')
        expect(persona.model.length).toBeGreaterThan(0)
      }

      // The engine event fed to onEvent appears verbatim on the wire.
      const verdictEvents = events.filter(e => e.type === 'persona-verdict')
      expect(verdictEvents).toHaveLength(1)
      expect(verdictEvents[0].verdict.personaId).toBe('hiring-manager')

      const synthesisEvents = events.filter(e => e.type === 'synthesis')
      expect(synthesisEvents).toHaveLength(1)
      expect(synthesisEvents[0].synthesis.verdict).toBe(fixtureSynthesis.verdict)

      const last = events[events.length - 1]
      expect(last.type).toBe('done')
      expect(typeof last.elapsedMs).toBe('number')

      // Engine invocation contract: fixed target inputs + run options.
      expect(runPanelMock).toHaveBeenCalledTimes(1)
      const [thesisArg, evidenceArg, configArg, optsArg] = runPanelMock.mock.calls[0]
      expect(thesisArg.targetId).toBe('courtfolio')
      expect(evidenceArg.targetId).toBe('courtfolio')
      expect(configArg.limits).toEqual({
        personaMaxOutputTokens: 2000,
        verifierMaxOutputTokens: 600,
        metaJudgeMaxOutputTokens: 4000,
      })
      expect(optsArg.minSurvivors).toBe(2)
      expect(optsArg.signal).toBeInstanceOf(AbortSignal)
      expect(typeof optsArg.onEvent).toBe('function')

      expect(markCompletedMock).toHaveBeenCalledWith('run-42', fixtureResult, 0)
      expect(markFailedMock).not.toHaveBeenCalled()
    })

    it('records the persona-failure count when the result is degraded', async () => {
      const degraded: PanelResult = {
        ...fixtureResult,
        personaFailures: [{ personaId: 'staff-mentor', errorType: 'APICallError' }],
      }
      runPanelMock.mockResolvedValue(degraded)

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      await res.text()
      expect(markCompletedMock).toHaveBeenCalledWith('run-42', degraded, 1)
    })

    it('counts verifier-failed rulings in the degradation count (kept out of the shared cache)', async () => {
      const verifierDegraded: PanelResult = {
        ...fixtureResult,
        verifiedGaps: [
          { ...fixtureGap, verdict: 'unverifiable', verifyNote: 'Verifier unavailable (APICallError).', verifierFailed: true },
        ],
        personaFailures: [{ personaId: 'staff-mentor', errorType: 'APICallError' }],
      }
      runPanelMock.mockResolvedValue(verifierDegraded)

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      await res.text()
      // 1 benched persona + 1 verifier-failed ruling = degradation count 2.
      expect(markCompletedMock).toHaveBeenCalledWith('run-42', verifierDegraded, 2)
    })

    it('records a client abort as AbortError (exempt from the failure cooldown)', async () => {
      runPanelMock.mockRejectedValue(new DOMException('Client disconnected.', 'AbortError'))

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      const events = await readEvents(res)

      const runError = events.find(e => e.type === 'run-error')
      expect(runError).toMatchObject({ stage: 'personas', errorType: 'AbortError' })
      expect(markFailedMock).toHaveBeenCalledWith('run-42', 'AbortError')
      expect(markCompletedMock).not.toHaveBeenCalled()
    })

    it('ends with run-error stage personas and records the failure when the engine rejects early', async () => {
      runPanelMock.mockRejectedValue(new Error('boom'))

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      expect(res.status).toBe(200)

      const events = await readEvents(res)
      expect(events[0].type).toBe('run-start')
      expect(events[events.length - 1]).toEqual({
        type: 'run-error',
        stage: 'personas',
        errorType: 'Error',
      })
      // Never a fake success after a failure.
      expect(events.some(e => e.type === 'synthesis')).toBe(false)
      expect(events.some(e => e.type === 'done')).toBe(false)

      expect(markFailedMock).toHaveBeenCalledWith('run-42', 'Error')
      expect(markCompletedMock).not.toHaveBeenCalled()
    })

    it('reports stage verify when the engine emitted verify-start before failing', async () => {
      runPanelMock.mockImplementation(async (...args: unknown[]) => {
        const opts = args[3] as PanelRunOptions
        opts.onEvent?.({ type: 'verify-start', gapCount: 1 })
        throw new Error('boom')
      })

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      const events = await readEvents(res)

      // The verify-start frame itself was forwarded before the failure.
      expect(events.some(e => e.type === 'verify-start')).toBe(true)
      expect(events[events.length - 1]).toEqual({
        type: 'run-error',
        stage: 'verify',
        errorType: 'Error',
      })
      expect(markFailedMock).toHaveBeenCalledWith('run-42', 'Error')
    })

    it('maps a survivor-floor failure to errorType PanelDegradedError', async () => {
      runPanelMock.mockRejectedValue(
        new PanelDegradedError(
          [fixtureVerdict],
          [
            { personaId: 'staff-mentor', errorType: 'APICallError' },
            { personaId: 'skeptical-peer', errorType: 'APICallError' },
          ],
          2
        )
      )

      const res = await POST(postRun({ targetId: 'courtfolio' }) as NextRequest)
      const events = await readEvents(res)
      expect(events[events.length - 1]).toEqual({
        type: 'run-error',
        stage: 'personas',
        errorType: 'PanelDegradedError',
      })
      expect(markFailedMock).toHaveBeenCalledWith('run-42', 'PanelDegradedError')
    })
  })
})
