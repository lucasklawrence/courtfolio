import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CardioSession } from '@/types/cardio'
import { CardioStatsCards, type CardioStatCard } from './CardioStatsCards'

/**
 * Helper — build a CardioSession with sane defaults. Override only what
 * the case under test needs.
 */
const session = (overrides: Partial<CardioSession> = {}): CardioSession => ({
  date: '2026-01-01',
  activity: 'stair',
  duration_seconds: 1800,
  avg_hr: 140,
  ...overrides,
})

const sessionsCountMetric: CardioStatCard = {
  key: 'sessions',
  label: 'Sessions',
  compute: (s) => s.length,
  formatValue: (v) => String(v),
  direction: 'higher-is-better',
}

const avgHrMetric: CardioStatCard = {
  key: 'avg_hr',
  label: 'Avg HR',
  compute: (s) => {
    const vals = s.map((x) => x.avg_hr).filter((v): v is number => typeof v === 'number')
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  },
  formatValue: (v) => Math.round(v).toString(),
  unit: 'BPM',
  direction: 'neutral',
}

describe('CardioStatsCards', () => {
  it('renders one card per metric with current values', () => {
    render(
      <CardioStatsCards
        current={[session(), session(), session()]}
        previous={[]}
        metrics={[sessionsCountMetric, avgHrMetric]}
      />,
    )
    const sessionsCard = screen.getByTestId('stat-card-sessions')
    expect(sessionsCard).toHaveTextContent('Sessions')
    expect(sessionsCard).toHaveTextContent('3')
    const hrCard = screen.getByTestId('stat-card-avg_hr')
    expect(hrCard).toHaveTextContent('Avg HR')
    expect(hrCard).toHaveTextContent('140')
    expect(hrCard).toHaveTextContent('BPM')
  })

  it('hides the delta line when previous has fewer than the threshold sessions', () => {
    render(
      <CardioStatsCards
        current={[session(), session()]}
        previous={[session(), session(), session()]}
        metrics={[sessionsCountMetric]}
      />,
    )
    expect(screen.getByTestId('stat-card-sessions-no-delta')).toBeInTheDocument()
    expect(screen.getByTestId('stat-card-sessions-no-delta')).toHaveTextContent(
      /no prior comparison/i,
    )
  })

  it('renders delta arrow, signed absolute, and percent when previous meets the threshold', () => {
    render(
      <CardioStatsCards
        current={[session(), session(), session(), session(), session(), session()]}
        previous={[session(), session(), session(), session()]}
        metrics={[sessionsCountMetric]}
      />,
    )
    const card = screen.getByTestId('stat-card-sessions')
    expect(card).toHaveTextContent('▲')
    expect(card).toHaveTextContent('+2')
    expect(card).toHaveTextContent('+50.0%')
    expect(screen.queryByTestId('stat-card-sessions-no-delta')).not.toBeInTheDocument()
  })

  it('uses the down arrow and a negative absolute when current < previous', () => {
    render(
      <CardioStatsCards
        current={[session(), session()]}
        previous={[session(), session(), session(), session(), session()]}
        metrics={[sessionsCountMetric]}
      />,
    )
    const card = screen.getByTestId('stat-card-sessions')
    expect(card).toHaveTextContent('▼')
    expect(card).toHaveTextContent('−3')
  })

  it('renders an em-dash when the current value is null', () => {
    const nullableMetric: CardioStatCard = {
      key: 'always_null',
      label: 'Nothing',
      compute: () => null,
      formatValue: (v) => String(v),
      direction: 'neutral',
    }
    render(
      <CardioStatsCards
        current={[session()]}
        previous={Array.from({ length: 4 }, () => session())}
        metrics={[nullableMetric]}
      />,
    )
    expect(screen.getByTestId('stat-card-always_null')).toHaveTextContent('—')
    expect(screen.getByTestId('stat-card-always_null-no-delta')).toBeInTheDocument()
  })

  it('paints higher-is-better up-changes in green and down-changes in red', () => {
    const greenUp = render(
      <CardioStatsCards
        current={Array.from({ length: 6 }, () => session())}
        previous={Array.from({ length: 4 }, () => session())}
        metrics={[sessionsCountMetric]}
      />,
    )
    expect(
      greenUp.getByTestId('stat-card-sessions').querySelector('.text-emerald-700'),
    ).not.toBeNull()
    greenUp.unmount()

    const redDown = render(
      <CardioStatsCards
        current={Array.from({ length: 4 }, () => session())}
        previous={Array.from({ length: 6 }, () => session())}
        metrics={[sessionsCountMetric]}
      />,
    )
    expect(
      redDown.getByTestId('stat-card-sessions').querySelector('.text-red-700'),
    ).not.toBeNull()
  })

  it('paints lower-is-better down-changes in green', () => {
    const lowerIsBetter: CardioStatCard = {
      ...sessionsCountMetric,
      key: 'rhr',
      label: 'RHR',
      direction: 'lower-is-better',
    }
    render(
      <CardioStatsCards
        current={[session(), session()]}
        previous={Array.from({ length: 5 }, () => session())}
        metrics={[lowerIsBetter]}
      />,
    )
    expect(screen.getByTestId('stat-card-rhr').querySelector('.text-emerald-700')).not.toBeNull()
  })

  it('uses neutral coloring for direction="neutral" regardless of change', () => {
    render(
      <CardioStatsCards
        current={Array.from({ length: 4 }, () => session({ avg_hr: 150 }))}
        previous={Array.from({ length: 4 }, () => session({ avg_hr: 100 }))}
        metrics={[avgHrMetric]}
      />,
    )
    const card = screen.getByTestId('stat-card-avg_hr')
    expect(card.querySelector('.text-emerald-700')).toBeNull()
    expect(card.querySelector('.text-red-700')).toBeNull()
    // Sanity: the up arrow is still rendered, just not colored.
    expect(card).toHaveTextContent('▲')
  })

  it('honors a custom formatDelta for unit-bearing metrics', () => {
    const durationMetric: CardioStatCard = {
      key: 'duration',
      label: 'Avg duration',
      compute: (s) =>
        s.length === 0
          ? null
          : s.reduce((acc, x) => acc + x.duration_seconds, 0) / s.length,
      formatValue: (v) => `${Math.round(v)}s`,
      formatDelta: (d) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(Math.round(d))}s`,
      direction: 'higher-is-better',
    }
    render(
      <CardioStatsCards
        current={Array.from({ length: 5 }, () => session({ duration_seconds: 2400 }))}
        previous={Array.from({ length: 5 }, () => session({ duration_seconds: 1800 }))}
        metrics={[durationMetric]}
      />,
    )
    const card = screen.getByTestId('stat-card-duration')
    expect(card).toHaveTextContent('+600s')
  })

  it('omits the percent label when previous value is 0', () => {
    const zeroPrev: CardioStatCard = {
      ...sessionsCountMetric,
      key: 'distance',
      label: 'Total distance',
      compute: (s) =>
        s.reduce((acc, x) => acc + (x.distance_meters ?? 0), 0),
      formatValue: (v) => `${v}m`,
    }
    // Previous has 4 sessions but all distance_meters undefined → metric value 0.
    render(
      <CardioStatsCards
        current={[session({ distance_meters: 500 })]}
        previous={Array.from({ length: 4 }, () => session())}
        metrics={[zeroPrev]}
      />,
    )
    const card = screen.getByTestId('stat-card-distance')
    expect(card).toHaveTextContent('+500m')
    // Percent must not render — would be "(+Infinity%)" otherwise.
    expect(card).not.toHaveTextContent('%')
  })
})
