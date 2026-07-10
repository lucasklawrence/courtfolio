import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LivePanelEvent, RunStartEvent } from '@/lib/draft-room/protocol'
import type { MetaSynthesis, PersonaVerdict, VerifiedGap } from '@/lib/panel/types'

import { useLivePanelRun } from './useLivePanelRun'

/**
 * Tests for the live-run client hook (#241): NDJSON stream reduction,
 * non-200 error mapping, dropped-stream detection, malformed-line
 * tolerance, and the terminal-frame guard.
 *
 * Transport is faked at the `fetch` global: each case hands the hook a
 * real `Response` wrapping a real `ReadableStream`, so the hook's actual
 * reader/decoder/line-split path runs unmodified.
 */

/** Encode one NDJSON line (or pass a raw string through for malformed-line cases). */
function encodeLine(line: LivePanelEvent | string): Uint8Array {
  const text = typeof line === 'string' ? line : JSON.stringify(line)
  return new TextEncoder().encode(text + '\n')
}

/** A 200 NDJSON response whose stream emits `lines` and then closes. */
function ndjsonResponse(lines: Array<LivePanelEvent | string>): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of lines) controller.enqueue(encodeLine(line))
        controller.close()
      },
    }),
    { status: 200 }
  )
}

/** A 200 NDJSON response the test drives frame-by-frame. */
function controlledNdjsonResponse(): {
  response: Response
  push: (line: LivePanelEvent | string) => void
  close: () => void
  fail: (error: unknown) => void
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    response: new Response(stream, { status: 200 }),
    push: line => controller.enqueue(encodeLine(line)),
    close: () => controller.close(),
    fail: error => controller.error(error),
  }
}

/** Minimal complete verdict for one persona. */
function makeVerdict(personaId: string, label: string): PersonaVerdict {
  return {
    personaId,
    label,
    scores: [{ axisId: 'learning-value', score: 7, rationale: 'transferable craft' }],
    gaps: [
      {
        claim: `${label} claim`,
        artifactShows: 'something narrower',
        citation: 'components/court/FreeRoamPlayer.tsx',
        confidence: 0.8,
      },
    ],
    uncomfortableTruth: 'the demo is the product',
  }
}

const verdictOne = makeVerdict('p1', 'Persona One')
const verdictTwo = makeVerdict('p2', 'Persona Two')

const runStart: RunStartEvent = {
  type: 'run-start',
  targetId: 'courtfolio',
  thesis: { targetId: 'courtfolio', claims: ['ships a real cross-family panel'] },
  personas: [
    { id: 'p1', label: 'Persona One', lens: 'lens one', model: 'anthropic/claude-haiku-4.5' },
    { id: 'p2', label: 'Persona Two', lens: 'lens two', model: 'openai/gpt-5-mini' },
  ],
  cached: false,
  startedAt: '2026-07-10T12:00:00.000Z',
}

const verifiedGaps: VerifiedGap[] = [
  {
    ...verdictOne.gaps[0],
    personaId: 'p1',
    gapIndex: 0,
    verdict: 'upheld',
    verifyNote: 'checks out against the file',
  },
  {
    ...verdictTwo.gaps[0],
    personaId: 'p2',
    gapIndex: 0,
    verdict: 'refuted',
    verifyNote: 'the cited file shows otherwise',
  },
]

const synthesis: MetaSynthesis = {
  targetId: 'courtfolio',
  scoreboard: [
    { personaId: 'p1', label: 'Persona One', scores: verdictOne.scores },
    { personaId: 'p2', label: 'Persona Two', scores: verdictTwo.scores },
  ],
  convergence: [],
  disagreements: [],
  robustFindings: ['finding'],
  topMoves: ['move'],
  caughtErrors: [],
  verdict: 'holds up, mostly',
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useLivePanelRun', () => {
  it('walks connecting → streaming → done and reduces every stage of the stream', async () => {
    const stream = controlledNdjsonResponse()
    fetchMock.mockResolvedValue(stream.response)

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    expect(result.current.state.status).toBe('idle')

    act(() => {
      result.current.start()
    })
    expect(result.current.state.status).toBe('connecting')

    await act(async () => {
      stream.push(runStart)
    })
    await waitFor(() => expect(result.current.state.status).toBe('streaming'))
    expect(result.current.state.runStart?.personas.map(p => p.id)).toEqual(['p1', 'p2'])

    await act(async () => {
      stream.push({ type: 'persona-verdict', verdict: verdictOne })
      stream.push({ type: 'persona-verdict', verdict: verdictTwo })
      stream.push({ type: 'verify-start', gapCount: 2 })
      stream.push({
        type: 'gap-verified',
        personaId: 'p1',
        gapIndex: 0,
        verdict: 'upheld',
        done: 1,
        total: 2,
      })
      stream.push({
        type: 'gap-verified',
        personaId: 'p2',
        gapIndex: 0,
        verdict: 'refuted',
        done: 2,
        total: 2,
      })
      stream.push({ type: 'gaps-verified', verifiedGaps })
      stream.push({ type: 'synthesis', synthesis })
      stream.push({ type: 'done', elapsedMs: 42_000 })
      stream.close()
    })

    await waitFor(() => expect(result.current.state.status).toBe('done'))
    const { state } = result.current
    expect(state.verdicts).toHaveLength(2)
    expect(state.verdicts.map(v => v.personaId)).toEqual(['p1', 'p2'])
    expect(state.verify).toEqual({ done: 2, total: 2 })
    expect(state.gapRulings).toEqual({ p1: { 0: 'upheld' }, p2: { 0: 'refuted' } })
    expect(state.verifiedGaps).toEqual(verifiedGaps)
    expect(state.synthesis).toEqual(synthesis)
    expect(state.elapsedMs).toBe(42_000)
    expect(state.error).toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/panel/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targetId: 'courtfolio' }),
      })
    )
  })

  it('maps a 429 with an in-progress body to an in-progress error with retry seconds', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ reason: 'in-progress', retryAfterSeconds: 90 }), {
        status: 429,
      })
    )

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.error).toEqual({ kind: 'in-progress', retryAfterSeconds: 90 })
  })

  it('maps a bare 429 (no JSON body) to rate-limited', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }))

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.error).toEqual({ kind: 'rate-limited' })
  })

  it('maps a 503 to unavailable', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.error).toEqual({ kind: 'unavailable' })
  })

  it('reports a network error when the stream ends without a terminal frame, keeping run-start', async () => {
    fetchMock.mockResolvedValue(ndjsonResponse([runStart]))

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.error).toEqual({ kind: 'network' })
    // Everything streamed before the drop stays on screen.
    expect(result.current.state.runStart?.targetId).toBe('courtfolio')
  })

  it('skips a malformed line and keeps reducing the valid frames around it', async () => {
    fetchMock.mockResolvedValue(
      ndjsonResponse([
        runStart,
        '{"type":"persona-verdict","verdict":', // truncated mid-write
        { type: 'persona-verdict', verdict: verdictTwo },
        { type: 'done', elapsedMs: 1_000 },
      ])
    )

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(result.current.state.status).toBe('done'))
    expect(result.current.state.verdicts).toEqual([verdictTwo])
    expect(result.current.state.elapsedMs).toBe(1_000)
    expect(result.current.state.error).toBeUndefined()
  })

  it('maps a rejected fetch (network failure) to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.error).toEqual({ kind: 'network' })
  })

  it('does not regress a done run when the connection errors afterwards', async () => {
    const stream = controlledNdjsonResponse()
    fetchMock.mockResolvedValue(stream.response)

    const { result } = renderHook(() => useLivePanelRun('courtfolio'))
    act(() => {
      result.current.start()
    })

    await act(async () => {
      stream.push(runStart)
      stream.push({ type: 'done', elapsedMs: 5_000 })
    })
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    // The connection dying after the terminal frame dispatches a `failed`
    // action; the reducer must ignore it — the run already succeeded.
    await act(async () => {
      stream.fail(new Error('connection reset'))
    })
    await act(async () => {})

    expect(result.current.state.status).toBe('done')
    expect(result.current.state.error).toBeUndefined()
    expect(result.current.state.elapsedMs).toBe(5_000)
  })
})
