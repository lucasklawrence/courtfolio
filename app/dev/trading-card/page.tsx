import type { JSX, ReactNode } from 'react'
import { TradingCard } from '@/components/training-facility/shared/TradingCard'
import type { Benchmark } from '@/types/movement'

/** Page metadata — hidden from search since `/dev/*` routes are dev-only smoke surfaces. */
export const metadata = {
  title: 'Trading card — dev',
  robots: { index: false, follow: false },
}

const history: Benchmark[] = [
  {
    date: '2026-01-15',
    bodyweight_lbs: 240.5,
    shuttle_5_10_5_s: 5.62,
    vertical_in: 19.5,
    sprint_10y_s: 1.98,
    notes: 'First baseline. Felt sluggish on the second 5-10-5.',
  },
  {
    date: '2026-02-15',
    bodyweight_lbs: 237.0,
    shuttle_5_10_5_s: 5.51,
    vertical_in: 20.25,
    sprint_10y_s: 1.95,
    notes: 'Better warmup, looser hips.',
  },
  {
    date: '2026-03-15',
    bodyweight_lbs: 234.2,
    shuttle_5_10_5_s: 5.45,
    vertical_in: 21.0,
    sprint_10y_s: 1.93,
    notes: 'Shorter rest between attempts. Tracking weight loss as a lever.',
  },
  {
    date: '2026-04-15',
    bodyweight_lbs: 231.4,
    shuttle_5_10_5_s: 5.38,
    vertical_in: 22.0,
    sprint_10y_s: 1.91,
    notes: 'PB across the board — first session feeling clean off the line.',
  },
]

const latestEntry = history[history.length - 1]
const baselineEntry = history[0]

/**
 * Hidden dev-only smoke page for the {@link TradingCard} component.
 * Renders two cards side-by-side: one with full history (latest entry sets
 * a PB on every metric) and one as a baseline (no prior history → no PB
 * badge). Used to visually verify the flip animation and PB detection
 * without wiring the card into a real consumer page.
 */
export default function TradingCardDemoPage(): JSX.Element {
  return (
    <main
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
            Trading card
          </h1>
          <p style={{ fontSize: 14, color: '#a3a3a3', maxWidth: '60ch' }}>
            Issue #53 — flippable Combine stat card. Click either card to flip. The left card has
            full history (latest is a PB across all four metrics), the right has no prior sessions
            (no PB badge possible).
          </p>
        </header>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Section title="Latest entry with full history (all PBs)">
            <TradingCard
              entry={latestEntry}
              history={history}
              playerNumber={11}
              playerName="Lucas L."
            />
          </Section>

          <Section title="First-ever entry (no history yet)">
            <TradingCard
              entry={baselineEntry}
              history={[baselineEntry]}
              playerNumber={11}
              playerName="Lucas L."
            />
          </Section>
        </div>
      </div>
    </main>
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
