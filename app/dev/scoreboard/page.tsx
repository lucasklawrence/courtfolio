import type { JSX, ReactNode } from 'react'
import { Scoreboard } from '@/components/training-facility/shared/Scoreboard'
import { deriveCombineScoreboardCells } from '@/components/training-facility/shared/scoreboard-utils'
import type { Benchmark } from '@/types/movement'

/** Page metadata — hidden from search since `/dev/*` routes are dev-only smoke surfaces. */
export const metadata = {
  title: 'Scoreboard — dev',
  robots: { index: false, follow: false },
}

/**
 * Synthetic four-month history with values trending in the right
 * direction across all four metrics (vertical up; weight, shuttle, sprint
 * down). Lets the dev page exercise the all-improvement visual state of
 * the scoreboard without needing real benchmark data on disk.
 */
const fullHistory: Benchmark[] = [
  {
    date: '2026-01-15',
    bodyweight_lbs: 240.5,
    shuttle_5_10_5_s: 5.62,
    vertical_in: 19.5,
    sprint_10y_s: 1.98,
  },
  {
    date: '2026-02-15',
    bodyweight_lbs: 237.0,
    shuttle_5_10_5_s: 5.51,
    vertical_in: 20.25,
    sprint_10y_s: 1.95,
  },
  {
    date: '2026-03-15',
    bodyweight_lbs: 234.2,
    shuttle_5_10_5_s: 5.45,
    vertical_in: 21.0,
    sprint_10y_s: 1.93,
  },
  {
    date: '2026-04-15',
    bodyweight_lbs: 231.4,
    shuttle_5_10_5_s: 5.38,
    vertical_in: 22.0,
    sprint_10y_s: 1.91,
  },
]

/** A single-entry "baseline" history — every metric should render as value === baseline (no delta line). */
const baselineOnly: Benchmark[] = [fullHistory[0]]

/** A mixed-direction history: vertical regressed; weight/shuttle/sprint improved. Exercises both green and red deltas. */
const mixedHistory: Benchmark[] = [
  fullHistory[0],
  {
    date: '2026-04-15',
    bodyweight_lbs: 231.4,
    shuttle_5_10_5_s: 5.38,
    vertical_in: 18.5, // worse than baseline 19.5 — should render red
    sprint_10y_s: 1.91,
  },
]

/**
 * Hidden dev-only smoke page for the {@link Scoreboard} component.
 * Renders three states stacked: full history with all improvements, a
 * mixed history with one regression, and a single-entry "no delta" view.
 */
export default function ScoreboardDemoPage(): JSX.Element {
  return (
    <div
      style={{
        backgroundColor: '#0a0a0a',
        color: '#f5f1e6',
        minHeight: '100vh',
        padding: '3rem 1.5rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem' }}>
          <p
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#fb923c',
              margin: 0,
            }}
          >
            Training Facility / dev
          </p>
          <h1 style={{ fontSize: '2.25rem', margin: '0.25rem 0 0.5rem', fontWeight: 800 }}>
            Scoreboard
          </h1>
          <p style={{ fontSize: 14, color: '#a3a3a3', maxWidth: '60ch' }}>
            Issue #63 — split-flap summary header for the Combine page. Reload the page to
            replay the cell-by-cell flip animation and the delta count-up.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <Section title="Full history — all four metrics improved">
            <Scoreboard cells={deriveCombineScoreboardCells(fullHistory)} />
          </Section>

          <Section title="Mixed — vertical regressed; everything else improved">
            <Scoreboard cells={deriveCombineScoreboardCells(mixedHistory)} />
          </Section>

          <Section title="Single entry — value equals baseline, no delta line">
            <Scoreboard cells={deriveCombineScoreboardCells(baselineOnly)} />
          </Section>

          <Section title="Empty history — em-dash placeholders">
            <Scoreboard cells={deriveCombineScoreboardCells([])} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#737373',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
