'use client'

/**
 * Client hook for the live panel stream (#241): POSTs to `/api/panel/run`,
 * reads the NDJSON response line-by-line, and reduces each
 * {@link LivePanelEvent} into render-ready state.
 *
 * Hand-rolled on purpose — a fetch reader + line split is ~30 lines, needs no
 * new dependency, and keeps the AI SDK out of the client bundle (the same
 * reasoning as `axes.ts`). A 30s no-frame watchdog aborts a wedged stream
 * (the server heartbeats every 10s, so 3 missed beats = stalled), and
 * unmounting aborts the fetch — which cancels the paid run server-side.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react'

import type { LivePanelEvent, RunStartEvent } from '@/lib/draft-room/protocol'
import type {
  MetaSynthesis,
  PersonaFailure,
  PersonaVerdict,
  VerifiedGap,
  VerifyVerdict,
} from '@/lib/panel/types'

/** Milliseconds without any frame (data or ping) before the stream is declared stalled. */
const STALL_MS = 30_000

/** Why a run ended without a full result. */
export interface LiveRunError {
  /** Failure class — drives the copy and whether the replay stays up. */
  kind: 'rate-limited' | 'in-progress' | 'unavailable' | 'run-error' | 'stalled' | 'network'
  /** Which pipeline stage died, for `run-error` only. */
  stage?: 'personas' | 'verify' | 'synthesis' | 'run'
  /** Seconds until a retry may succeed, when the server said so (429s). */
  retryAfterSeconds?: number
}

/** Everything the live UI renders, reduced from the event stream. */
export interface LivePanelRunState {
  /** Lifecycle: `idle` until the first run is requested. */
  status: 'idle' | 'connecting' | 'streaming' | 'done' | 'error'
  /** The run-start frame: roster, thesis, cached/live honesty metadata. */
  runStart?: RunStartEvent
  /** Verdicts received so far, in arrival order. */
  verdicts: PersonaVerdict[]
  /** Personas benched by failed model calls. */
  personaErrors: PersonaFailure[]
  /** Verify-stage progress (`done` of `total`), once the stage starts. */
  verify?: { done: number; total: number }
  /** The fact-checker's ruling per persona per gap index, as each settles. */
  gapRulings: Record<string, Partial<Record<number, VerifyVerdict>>>
  /** The complete ruling set, once the verify stage finishes. */
  verifiedGaps?: VerifiedGap[]
  /** The meta-judge synthesis — the last substantive frame. */
  synthesis?: MetaSynthesis
  /** Wall-clock run time from the `done` frame (0 for replays). */
  elapsedMs?: number
  /** Why the run ended early, when it did. */
  error?: LiveRunError
}

/** Initial (and reset) hook state. */
const IDLE_STATE: LivePanelRunState = {
  status: 'idle',
  verdicts: [],
  personaErrors: [],
  gapRulings: {},
}

/** Reducer actions: lifecycle transitions plus one action per stream frame. */
type Action =
  | { type: 'connecting' }
  | { type: 'frame'; event: LivePanelEvent }
  | { type: 'failed'; error: LiveRunError }

/** Reduce one stream frame (or lifecycle transition) into render state. */
function reduce(state: LivePanelRunState, action: Action): LivePanelRunState {
  if (action.type === 'connecting') {
    return { ...IDLE_STATE, status: 'connecting' }
  }
  if (action.type === 'failed') {
    // Terminal frames win: a network hiccup after `done` is not an error.
    if (state.status === 'done' || state.status === 'error') return state
    return { ...state, status: 'error', error: action.error }
  }

  const { event } = action
  switch (event.type) {
    case 'run-start':
      return { ...state, status: 'streaming', runStart: event }
    case 'persona-verdict':
      return { ...state, verdicts: [...state.verdicts, event.verdict] }
    case 'persona-error':
      return {
        ...state,
        personaErrors: [
          ...state.personaErrors,
          { personaId: event.personaId, errorType: event.errorType },
        ],
      }
    case 'verify-start':
      return { ...state, verify: { done: 0, total: event.gapCount } }
    case 'gap-verified':
      return {
        ...state,
        verify: { done: event.done, total: event.total },
        gapRulings: {
          ...state.gapRulings,
          [event.personaId]: {
            ...state.gapRulings[event.personaId],
            [event.gapIndex]: event.verdict,
          },
        },
      }
    case 'gaps-verified':
      return { ...state, verifiedGaps: event.verifiedGaps }
    case 'synthesis':
      return { ...state, synthesis: event.synthesis }
    case 'done':
      return { ...state, status: 'done', elapsedMs: event.elapsedMs }
    case 'run-error':
      // A completed run stays completed — a stray frame after `done` (which
      // the server never sends) must not regress a delivered result.
      if (state.status === 'done') return state
      return {
        ...state,
        status: 'error',
        error: { kind: 'run-error', stage: event.stage },
      }
    case 'ping':
      return state
  }
}

/** Map a non-200 response to a {@link LiveRunError}. */
async function errorFromResponse(res: Response): Promise<LiveRunError> {
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as {
      reason?: string
      retryAfterSeconds?: number
    }
    return {
      kind: body.reason === 'in-progress' ? 'in-progress' : 'rate-limited',
      ...(typeof body.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: body.retryAfterSeconds }
        : {}),
    }
  }
  if (res.status === 503) return { kind: 'unavailable' }
  return { kind: 'network' }
}

/** Return value of {@link useLivePanelRun}. */
export interface UseLivePanelRun {
  /** Current reduced stream state. */
  state: LivePanelRunState
  /** Start a live run (aborts any run already in flight). */
  start: () => void
}

/**
 * Drive one live panel run for a target and expose its reduced state.
 * See the module doc for transport and watchdog behavior.
 *
 * @param targetId the registered live target to run (e.g. `courtfolio`)
 */
export function useLivePanelRun(targetId: string): UseLivePanelRun {
  const [state, dispatch] = useReducer(reduce, IDLE_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Abort on unmount: the server treats a cancelled stream as "stop paying".
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
    }
  }, [])

  const start = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    dispatch({ type: 'connecting' })

    const armStallWatchdog = () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
      stallTimerRef.current = setTimeout(() => {
        dispatch({ type: 'failed', error: { kind: 'stalled' } })
        controller.abort()
      }, STALL_MS)
    }

    const run = async () => {
      const res = await fetch('/api/panel/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        dispatch({ type: 'failed', error: await errorFromResponse(res) })
        return
      }

      armStallWatchdog()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let terminal = false

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        armStallWatchdog()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let event: LivePanelEvent
          try {
            event = JSON.parse(line) as LivePanelEvent
          } catch {
            // A malformed line can only be truncation mid-write; the missing
            // terminal frame is caught below.
            continue
          }
          if (event.type === 'done' || event.type === 'run-error') terminal = true
          dispatch({ type: 'frame', event })
        }
      }

      // Stream ended without `done`/`run-error`: the connection dropped.
      if (!terminal) dispatch({ type: 'failed', error: { kind: 'network' } })
    }

    run()
      .catch(() => {
        // fetch/read threw (abort, network drop). The reducer ignores this
        // after a terminal frame or an earlier failure (e.g. the watchdog).
        dispatch({ type: 'failed', error: { kind: 'network' } })
      })
      .finally(() => {
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
      })
  }, [targetId])

  return { state, start }
}
