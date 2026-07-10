import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RunStartEvent } from '@/lib/draft-room/protocol'
import type { MetaSynthesis, PanelResult, PersonaVerdict } from '@/lib/panel/types'

import { LiveDraftRoom } from './LiveDraftRoom'
import type { LivePanelRunState, UseLivePanelRun } from './useLivePanelRun'

/**
 * Tests for the live Draft Room island (#241). The stream hook is mocked to
 * a controlled `{ state, start }`, so each case renders one exact reduced
 * state and asserts the honesty rules: replay until run-start, real skeleton
 * cards per roster slot, benched personas said plainly, verify progress,
 * synthesis last, and failures that keep whatever already streamed.
 */

const useLivePanelRunMock = vi.fn<(targetId: string) => UseLivePanelRun>()

vi.mock('./useLivePanelRun', () => ({
  useLivePanelRun: (targetId: string) => useLivePanelRunMock(targetId),
}))

/** Minimal complete verdict for one persona. */
function makeVerdict(personaId: string, label: string): PersonaVerdict {
  return {
    personaId,
    label,
    scores: [{ axisId: 'learning-value', score: 7, rationale: 'transferable craft' }],
    gaps: [
      {
        claim: `${label} found a gap`,
        artifactShows: 'something narrower',
        citation: 'lib/panel/index.ts',
        confidence: 0.8,
      },
    ],
    uncomfortableTruth: 'the demo is the product',
  }
}

const replayVerdict = makeVerdict('replay-peer', 'Replay Peer')

const replaySynthesis: MetaSynthesis = {
  targetId: 'courtfolio',
  scoreboard: [{ personaId: 'replay-peer', label: 'Replay Peer', scores: replayVerdict.scores }],
  convergence: [],
  disagreements: [],
  robustFindings: ['stored finding'],
  topMoves: ['stored move'],
  caughtErrors: [],
  verdict: 'the stored replay verdict',
}

/** The stored result shown until (and instead of) a live run. */
const replay: PanelResult = {
  thesis: { targetId: 'courtfolio', claims: ['claim one', 'claim two'] },
  verdicts: [replayVerdict],
  verifiedGaps: [],
  synthesis: replaySynthesis,
}

/** A three-vendor roster, as the run-start frame announces it. */
const runStart: RunStartEvent = {
  type: 'run-start',
  targetId: 'courtfolio',
  thesis: replay.thesis,
  personas: [
    { id: 'p-anthropic', label: 'Persona One', lens: 'lens one', model: 'anthropic/claude-haiku-4.5' },
    { id: 'p-openai', label: 'Persona Two', lens: 'lens two', model: 'openai/gpt-5-mini' },
    { id: 'p-google', label: 'Persona Three', lens: 'lens three', model: 'google/gemini-2.5-flash' },
  ],
  cached: false,
  startedAt: new Date().toISOString(),
}

/** The one live verdict used across streaming cases (the openai seat reports first). */
const liveVerdict = makeVerdict('p-openai', 'Persona Two')

const liveSynthesis: MetaSynthesis = {
  ...replaySynthesis,
  scoreboard: [{ personaId: 'p-openai', label: 'Persona Two', scores: liveVerdict.scores }],
  verdict: 'the live synthesis verdict',
}

/** Base (idle) hook state. */
const IDLE_STATE: LivePanelRunState = {
  status: 'idle',
  verdicts: [],
  personaErrors: [],
  gapRulings: {},
}

/** Build a hook state on top of idle. */
function stateWith(overrides: Partial<LivePanelRunState>): LivePanelRunState {
  return { ...IDLE_STATE, ...overrides }
}

/** Point the mocked hook at `state` and render the island. Returns the start spy. */
function renderWith(state: LivePanelRunState): ReturnType<typeof vi.fn> {
  const start = vi.fn()
  useLivePanelRunMock.mockReturnValue({ state, start })
  render(<LiveDraftRoom replay={replay} illustrative targetId="courtfolio" />)
  return start
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('LiveDraftRoom', () => {
  it('idle: shows the run button over the stored replay body, and the button starts a run', async () => {
    const start = renderWith(IDLE_STATE)

    expect(
      screen.getByRole('heading', { name: 'The panel weighs in — independently' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Replay Peer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The meta-judge synthesizes' })).toBeInTheDocument()
    // The replay is hand-authored, and idle says so.
    expect(screen.getByText(/Illustrative —/)).toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Run it live' })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('streaming: renders the finished verdict card and pending cards with model chips for the rest', () => {
    renderWith(stateWith({ status: 'streaming', runStart, verdicts: [liveVerdict] }))

    // The seat that reported gets a real card; the other two are visibly deliberating.
    expect(screen.getByRole('heading', { name: 'Persona Two' })).toBeInTheDocument()
    expect(screen.getByText(/Persona Two found a gap/)).toBeInTheDocument()
    expect(screen.getAllByText('Deliberating…')).toHaveLength(2)
    expect(screen.getByText('claude-haiku-4.5')).toBeInTheDocument()
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()

    // Live mode replaces the replay body and drops the illustrative badge.
    expect(screen.queryByRole('heading', { name: 'Replay Peer' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Illustrative —/)).not.toBeInTheDocument()

    // The run button is locked while the panel deliberates.
    expect(screen.getByRole('button', { name: 'Panel deliberating…' })).toBeDisabled()
  })

  it('streaming: a benched persona gets a plain did-not-report card', () => {
    renderWith(
      stateWith({
        status: 'streaming',
        runStart,
        verdicts: [liveVerdict],
        personaErrors: [{ personaId: 'p-google', errorType: 'TimeoutError' }],
      })
    )

    expect(
      screen.getByText(/Did not report — the model call failed \(TimeoutError\)/)
    ).toBeInTheDocument()
    // The benched seat no longer pulses; only the anthropic seat is still pending.
    expect(screen.getAllByText('Deliberating…')).toHaveLength(1)
  })

  it('streaming: shows verify progress until the synthesis arrives', () => {
    renderWith(
      stateWith({
        status: 'streaming',
        runStart,
        verdicts: [liveVerdict],
        verify: { done: 3, total: 5 },
      })
    )

    const progress = screen.getByText(/Fact-checking/)
    expect(progress).toHaveTextContent('3/5 gaps re-checked')
    // No synthesis yet, so the closing sections are absent.
    expect(screen.queryByRole('heading', { name: 'Converge vs. split' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'The meta-judge synthesizes' })
    ).not.toBeInTheDocument()
  })

  it('streaming: renders the agreement map and synthesis once the synthesis frame lands', () => {
    renderWith(
      stateWith({
        status: 'streaming',
        runStart,
        verdicts: [liveVerdict],
        verify: { done: 5, total: 5 },
        synthesis: liveSynthesis,
      })
    )

    expect(screen.getByRole('heading', { name: 'Converge vs. split' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The meta-judge synthesizes' })).toBeInTheDocument()
    expect(screen.getByText('the live synthesis verdict')).toBeInTheDocument()
    // The synthesis supersedes the verify progress line.
    expect(screen.queryByText(/Fact-checking/)).not.toBeInTheDocument()
  })

  it('done: labels the run with its wall-clock time', () => {
    renderWith(
      stateWith({
        status: 'done',
        runStart,
        verdicts: [liveVerdict],
        synthesis: liveSynthesis,
        elapsedMs: 42_000,
      })
    )

    expect(screen.getByText(/Live run — completed in 42s/)).toBeInTheDocument()
  })

  it('labels a cached stream as a replay of a real run', () => {
    const startedAt = new Date(Date.now() - 3 * 60_000).toISOString()
    renderWith(
      stateWith({
        status: 'streaming',
        runStart: { ...runStart, cached: true, startedAt },
        verdicts: [liveVerdict],
      })
    )

    expect(screen.getByText(/Replay of a real run from 3 min ago/)).toBeInTheDocument()
  })

  it('run-error mid-run: names the failed stage and keeps the cards that already streamed', () => {
    renderWith(
      stateWith({
        status: 'error',
        error: { kind: 'run-error', stage: 'verify' },
        runStart,
        verdicts: [liveVerdict],
        verify: { done: 1, total: 4 },
      })
    )

    expect(screen.getByText(/The run failed during the verify stage/)).toBeInTheDocument()
    // Everything already streamed stays up.
    expect(screen.getByRole('heading', { name: 'Persona Two' })).toBeInTheDocument()
    expect(screen.getAllByText('Deliberating…')).toHaveLength(2)
    // The in-flight progress line is dropped — the verify stage is dead.
    expect(screen.queryByText(/Fact-checking/)).not.toBeInTheDocument()
  })

  it('refused before run-start: keeps the replay body and explains the budget', () => {
    renderWith(stateWith({ status: 'error', error: { kind: 'rate-limited' } }))

    expect(screen.getByText(/hit its run budget/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Replay Peer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The meta-judge synthesizes' })).toBeInTheDocument()
    // No stream ever started, so nothing live is on screen.
    expect(screen.queryByText('Deliberating…')).not.toBeInTheDocument()
  })
})
