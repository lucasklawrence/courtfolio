/**
 * Tests for the two-era contrast panel (#437).
 *
 * The panel's whole reason for existing is that it *doesn't* subtract one era
 * from the other, so the cases here are about each side being stated on its own
 * terms — and about the roster buckets, where an empty one ("nothing new since")
 * is itself the finding rather than an absence to hide.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildExerciseLabels } from '@/lib/training-facility/exercise-labels'
import type { LogEra, LogEras } from '@/lib/training-facility/log-eras'

import { EraContrastPanel } from './EraContrastPanel'

const LABELS = buildExerciseLabels([
  { slug: 'barbell-bench-press', display_name: 'Barbell Bench Press' },
  { slug: 'pushups', display_name: 'Pushups' },
  { slug: 'pullups', display_name: 'Pullups' },
])

function era(overrides: Partial<LogEra> = {}): LogEra {
  return {
    startDayKey: '2022-03-03',
    endDayKey: '2024-04-18',
    trainingDays: 181,
    sets: 5109,
    reps: 53_459,
    loadedSets: 2778,
    loadedShare: 2778 / 5109,
    movements: 48,
    ...overrides,
  }
}

function eras(overrides: Partial<LogEras> = {}): LogEras {
  return {
    then: era(),
    now: era({
      startDayKey: '2026-05-25',
      endDayKey: '2026-08-09',
      trainingDays: 65,
      sets: 1564,
      reps: 16_212,
      loadedSets: 214,
      loadedShare: 214 / 1564,
      movements: 6,
    }),
    gapDays: 767,
    // Two trained months either side of a 24-month layoff. The panel counts the
    // gap off these rather than dividing `gapDays` by an average month, so a
    // fixture without them has no layoff to describe.
    months: [
      { monthKey: '2024-03', trainingDays: 6, era: 'then' as const },
      { monthKey: '2024-04', trainingDays: 4, era: 'then' as const },
      ...Array.from({ length: 24 }, (_, i) => ({
        monthKey: `gap-${String(i).padStart(2, '0')}`,
        trainingDays: 0,
        era: 'gap' as const,
      })),
      { monthKey: '2026-05', trainingDays: 5, era: 'now' as const },
    ],
    roster: { thenOnly: ['barbell-bench-press'], shared: ['pullups'], nowOnly: [] },
    ...overrides,
  }
}

describe('EraContrastPanel', () => {
  it('states each era on its own terms', () => {
    render(<EraContrastPanel eras={eras()} exerciseLabels={LABELS} />)
    expect(screen.getByTestId('era-then')).toHaveTextContent('5,109')
    expect(screen.getByTestId('era-then')).toHaveTextContent('48')
    expect(screen.getByTestId('era-now')).toHaveTextContent('1,564')
    expect(screen.getByTestId('era-now')).toHaveTextContent('6')
  })

  it('shows the loaded share, which is where the change in kind lives', () => {
    render(<EraContrastPanel eras={eras()} exerciseLabels={LABELS} />)
    expect(screen.getByTestId('era-then')).toHaveTextContent('54%')
    expect(screen.getByTestId('era-now')).toHaveTextContent('14%')
  })

  it('counts the layoff off the drawn months, not off an average month length', () => {
    // 767 days ÷ 30.44 rounds to 25, while the calendar shows 24 empty months.
    // Both used to render on the same screen; the drawn count is the one the
    // reader can check against the chart.
    render(<EraContrastPanel eras={eras()} exerciseLabels={LABELS} />)
    expect(screen.getByTestId('era-contrast')).toHaveTextContent('24 months')
    expect(screen.getByTestId('era-contrast')).not.toHaveTextContent('25 months')
  })

  it('names the movements in each bucket rather than only counting them', () => {
    render(<EraContrastPanel eras={eras()} exerciseLabels={LABELS} />)
    expect(screen.getByTestId('era-roster-then-only')).toHaveTextContent('Barbell Bench Press')
    expect(screen.getByTestId('era-roster-shared')).toHaveTextContent('Pullups')
  })

  it('says so when an era added nothing new, instead of rendering blank', () => {
    render(<EraContrastPanel eras={eras()} exerciseLabels={LABELS} />)
    expect(screen.getByTestId('era-roster-now-only')).toHaveTextContent(
      'Nothing new has been added since.'
    )
  })

  it('states no combined figure across the two eras', () => {
    // The panel must not present a single number spanning both — barbell
    // tonnage and push-up reps don't add up to anything.
    render(<EraContrastPanel eras={eras()} exerciseLabels={LABELS} />)
    const text = screen.getByTestId('era-contrast').textContent ?? ''
    const combinedSets = (5109 + 1564).toLocaleString()
    expect(text).not.toContain(combinedSets)
  })
})
