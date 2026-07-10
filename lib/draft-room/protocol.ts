/**
 * Wire protocol for the live panel stream (#241): the NDJSON event union the
 * route emits and the client consumes, plus {@link resultToEvents}, which
 * replays a stored {@link PanelResult} through the *same* protocol.
 *
 * `resultToEvents` is deliberately the single source of replayed event
 * sequences — the cache-hit path and the e2e stub both stream through it, so
 * neither can drift from what a real live run emits.
 *
 * Everything here is isomorphic (plain types + a pure function): the client
 * imports the types, the route imports the function. Nothing from the AI SDK
 * crosses into this module, keeping it out of the client bundle.
 */
import type { PanelEvent, PanelResult, Thesis } from '@/lib/panel/types'

/** A persona's identity as announced at run start (before any verdict exists). */
export interface RunStartPersona {
  /** Persona id, e.g. `hiring-manager`. */
  id: string
  /** Display label, e.g. `Skeptical Hiring Manager`. */
  label: string
  /** One-line description of the persona's judging lens. */
  lens: string
  /** Gateway model id this persona runs on (e.g. `anthropic/claude-haiku-4.5`) — shown as the card's model chip. */
  model: string
}

/**
 * Everything the client needs to lay out the run before any result arrives:
 * the fixed thesis, the panel roster (for skeleton cards), and honesty
 * metadata (`cached` + `startedAt` drive the "live" vs "cached run" label).
 */
export interface RunStartEvent {
  /** Discriminator. */
  type: 'run-start'
  /** Target being judged, e.g. `courtfolio`. */
  targetId: string
  /** The fixed, owner-authored thesis under test. */
  thesis: Thesis
  /** The panel roster, in config order. */
  personas: RunStartPersona[]
  /** True when this stream replays a stored run instead of spending on a new one. */
  cached: boolean
  /** ISO timestamp of when the run actually ran (now, for live; earlier, for cached). */
  startedAt: string
}

/**
 * One frame on the live panel NDJSON stream. The engine's {@link PanelEvent}s
 * pass through verbatim; the route adds transport framing around them.
 */
export type LivePanelEvent =
  | RunStartEvent
  | PanelEvent
  /** Keep-alive frame during quiet stages; carries no data. */
  | { type: 'ping' }
  /** The meta-judge synthesis — the last substantive frame. */
  | { type: 'synthesis'; synthesis: PanelResult['synthesis'] }
  /** Terminal success frame. `elapsedMs` is 0 for replayed (cached/stub) runs. */
  | { type: 'done'; elapsedMs: number }
  /**
   * Terminal failure frame. Everything already streamed stays valid — the
   * client keeps rendered cards and shows the failure honestly. `errorType`
   * is a constructor name only (never a message).
   */
  | { type: 'run-error'; stage: 'personas' | 'verify' | 'synthesis' | 'run'; errorType: string }

/** Options for {@link resultToEvents}. */
export interface ResultToEventsOptions {
  /** Whether the stream should be labeled as a cached replay. */
  cached: boolean
  /** ISO timestamp of when the replayed run originally ran. */
  startedAt: string
  /** Model id per persona id, for the run-start roster. */
  modelByPersonaId: Record<string, string>
  /** Lens per persona id, for the run-start roster. */
  lensByPersonaId: Record<string, string>
}

/**
 * Replay a stored {@link PanelResult} as the exact event sequence a live run
 * would have produced: run-start → persona verdicts (and recorded persona
 * errors) → verify-start → per-gap rulings → gaps-verified → synthesis → done.
 */
export function resultToEvents(
  result: PanelResult,
  opts: ResultToEventsOptions
): LivePanelEvent[] {
  const events: LivePanelEvent[] = [
    {
      type: 'run-start',
      targetId: result.thesis.targetId,
      thesis: result.thesis,
      personas: result.verdicts.map(v => ({
        id: v.personaId,
        label: v.label,
        lens: opts.lensByPersonaId[v.personaId] ?? '',
        model: opts.modelByPersonaId[v.personaId] ?? '',
      })),
      cached: opts.cached,
      startedAt: opts.startedAt,
    },
  ]

  for (const verdict of result.verdicts) {
    events.push({ type: 'persona-verdict', verdict })
  }
  for (const failure of result.personaFailures ?? []) {
    events.push({ type: 'persona-error', ...failure })
  }

  events.push({ type: 'verify-start', gapCount: result.verifiedGaps.length })
  result.verifiedGaps.forEach((gap, i) => {
    events.push({
      type: 'gap-verified',
      personaId: gap.personaId,
      gapIndex: gap.gapIndex,
      verdict: gap.verdict,
      done: i + 1,
      total: result.verifiedGaps.length,
    })
  })
  events.push({ type: 'gaps-verified', verifiedGaps: result.verifiedGaps })

  events.push({ type: 'synthesis', synthesis: result.synthesis })
  events.push({ type: 'done', elapsedMs: 0 })

  return events
}
