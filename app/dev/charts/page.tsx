import type { JSX } from 'react'
import { Patrick_Hand } from 'next/font/google'
import {
  RoughBar,
  RoughLine,
  RoughScatter,
  chartPalette,
} from '@/components/training-facility/shared/charts'

const patrickHand = Patrick_Hand({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-patrick-hand',
})

export const metadata = {
  title: 'Chart primitives — dev',
  robots: { index: false, follow: false },
}

const verticalJumpData = [
  { date: new Date('2026-01-15'), inches: 19.5 },
  { date: new Date('2026-02-15'), inches: 20.25 },
  { date: new Date('2026-03-15'), inches: 21.0 },
  { date: new Date('2026-04-15'), inches: 22.0 },
]

const hrZoneData = [
  { zone: 'Z1', minutes: 12 },
  { zone: 'Z2', minutes: 38 },
  { zone: 'Z3', minutes: 22 },
  { zone: 'Z4', minutes: 14 },
  // Zero on purpose — exercises the "render a 1px baseline rather than
  // disappearing the category" path in RoughBar.
  { zone: 'Z5', minutes: 0 },
]

const paceVsHrData = [
  { hr: 142, pace: 9.8 },
  { hr: 148, pace: 9.4 },
  { hr: 151, pace: 9.2 },
  { hr: 156, pace: 8.9 },
  { hr: 162, pace: 8.5 },
  { hr: 165, pace: 8.3 },
  { hr: 158, pace: 8.7 },
  { hr: 144, pace: 9.7 },
  { hr: 170, pace: 8.1 },
]

export default function ChartsDemoPage(): JSX.Element {
  return (
    <main
      className={patrickHand.variable}
      style={{
        backgroundColor: chartPalette.courtLineCream,
        color: chartPalette.inkBlack,
        minHeight: '100vh',
        padding: '3rem 1.5rem',
        fontFamily: 'var(--font-patrick-hand), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ marginBottom: '2.5rem' }}>
          <p
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: chartPalette.rimOrange,
              margin: 0,
            }}
          >
            Training Facility / dev
          </p>
          <h1 style={{ fontSize: '2.75rem', margin: '0.25rem 0 0.5rem' }}>Chart primitives</h1>
          <p
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 14,
              color: chartPalette.inkSoft,
              maxWidth: 60 + 'ch',
            }}
          >
            Issue #55 — hand-drawn line, bar, and scatter built on rough.js + d3-scale. Sample data
            simulates the Combine vertical-jump trend, a Gym HR-zone distribution, and a pace-vs-HR
            scatter from a stair session.
          </p>
        </header>

        <Section title="RoughLine — Vertical jump over time">
          <RoughLine
            data={verticalJumpData}
            x={(d) => d.date}
            y={(d) => d.inches}
            width={720}
            height={300}
            xLabel="Date"
            yLabel="Vertical (in)"
            yTickFormat={(v) => `${v}`}
            ariaLabel="Vertical jump in inches by month, January through April 2026"
          />
        </Section>

        <Section title="RoughBar — Time in HR zone (single session)">
          <RoughBar
            data={hrZoneData}
            x={(d) => d.zone}
            y={(d) => d.minutes}
            width={720}
            height={300}
            xLabel="Zone"
            yLabel="Minutes"
            yTickFormat={(v) => `${v}`}
            ariaLabel="Minutes spent in each heart-rate zone for a single session"
          />
        </Section>

        <Section title="RoughScatter — Pace at heart rate">
          <RoughScatter
            data={paceVsHrData}
            x={(d) => d.hr}
            y={(d) => d.pace}
            width={720}
            height={300}
            xLabel="Heart rate (bpm)"
            yLabel="Pace (min/mi)"
            xTickFormat={(v) => `${v}`}
            yTickFormat={(v) => v.toFixed(1)}
            ariaLabel="Pace in minutes per mile plotted against heart rate during a stair session"
          />
        </Section>

        <Section title="Empty state — RoughLine with no data">
          <RoughLine
            data={[]}
            x={(d: { date: Date; inches: number }) => d.date}
            y={(d) => d.inches}
            width={720}
            height={140}
            ariaLabel="Vertical jump trend (no data yet)"
            emptyMessage="No benchmark data yet"
          />
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: chartPalette.inkSoft,
          margin: '0 0 0.75rem',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: `1px solid ${chartPalette.hardwoodTan}`,
          borderRadius: 12,
          padding: '1rem',
          overflow: 'auto',
        }}
      >
        {children}
      </div>
    </section>
  )
}
