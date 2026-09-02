import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { FocusAdherence, FocusLoadStats } from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'

import { MonthlyFocusCard } from './MonthlyFocusCard'

const FOCUS: MonthlyFocus = {
  id: 'f1',
  exercise: 'shrugs',
  daily_target: 100,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

const ADHERENCE: FocusAdherence = {
  daysInWindow: 31,
  daysElapsed: 5,
  daysHit: 4,
  currentStreak: 1,
  percent: 0.8,
}

const WEIGHTED_LOAD: FocusLoadStats = {
  topSetLbs: 120,
  avgLoadLbs: 105,
  tonnageLbs: 5800,
  weightedSets: 6,
  loadMultiplier: 1,
}

/** A two-dumbbell movement: same per-implement loads, doubled tonnage. */
const PAIRED_LOAD: FocusLoadStats = {
  topSetLbs: 60,
  avgLoadLbs: 50,
  tonnageLbs: 11600,
  weightedSets: 6,
  loadMultiplier: 2,
}

const BODYWEIGHT_LOAD: FocusLoadStats = {
  topSetLbs: null,
  avgLoadLbs: null,
  tonnageLbs: 0,
  weightedSets: 0,
  loadMultiplier: 1,
}

describe('MonthlyFocusCard', () => {
  it('shows the category label, exercise, and today progress against the target', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={WEIGHTED_LOAD}
      />
    )
    expect(screen.getByText('Upper Focus')).toBeInTheDocument()
    expect(screen.getByText('shrugs')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText(/\/ 100 reps today/)).toBeInTheDocument()
  })

  it('labels a lower-body focus as "Lower Focus"', () => {
    render(
      <MonthlyFocusCard
        focus={{ ...FOCUS, category: 'lower' }}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />
    )
    expect(screen.getByText('Lower Focus')).toBeInTheDocument()
    expect(screen.queryByText('Upper Focus')).not.toBeInTheDocument()
  })

  it('renders windowed adherence (day, days-hit, streak)', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />
    )
    expect(screen.getByText('5/31')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1d')).toBeInTheDocument()
  })

  it('shows the campaign calendar window', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />
    )
    expect(screen.getByTestId('monthly-focus-shrugs-window').textContent).toMatch(/Jul 1 .* Jul 31/)
  })

  it('shows load stats only when the focus has weighted sets', () => {
    const { rerender } = render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={WEIGHTED_LOAD}
      />
    )
    expect(screen.getByText('Top set')).toBeInTheDocument()
    expect(screen.getByText('120 lb')).toBeInTheDocument()
    expect(screen.getByText('5,800 lb')).toBeInTheDocument()

    rerender(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />
    )
    expect(screen.queryByText('Top set')).not.toBeInTheDocument()
  })

  it('shows only the per-implement load for a single-implement movement', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={WEIGHTED_LOAD}
      />
    )
    // Nothing to disambiguate when one implement is moved, so no second reading.
    expect(screen.queryByText(/^×\d/)).not.toBeInTheDocument()
  })

  it('shows both readings of the load for a two-implement movement', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={PAIRED_LOAD}
      />
    )
    // Per-implement headline — the number on one dumbbell, as logged...
    expect(screen.getByText('60 lb')).toBeInTheDocument()
    expect(screen.getByText('50 lb')).toBeInTheDocument()
    // ...with the total actually carried underneath, matching the Trophy Room's
    // load badges so neither surface has to be translated.
    expect(screen.getByText('×2 · 120 lb')).toBeInTheDocument()
    expect(screen.getByText('×2 · 100 lb')).toBeInTheDocument()
    // Tonnage already counts both implements, so it gets no second reading.
    expect(screen.getByText('11,600 lb')).toBeInTheDocument()
  })

  it('marks the daily target as met when today progress reaches it', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />
    )
    expect(screen.getByTitle('Daily target met')).toBeInTheDocument()
  })

  it('labels the unit as "sets" for a sets-based target', () => {
    render(
      <MonthlyFocusCard
        focus={{ ...FOCUS, target_kind: 'sets', daily_target: 5 }}
        todayProgress={3}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />
    )
    expect(screen.getByText(/\/ 5 sets today/)).toBeInTheDocument()
  })
})

describe('MonthlyFocusCard — catalog labels (#384)', () => {
  it('renders the catalog label and keys off the slug', () => {
    const focus = { ...FOCUS, exercise: 'farmers-carry', display_name: "Farmer's Carry" }
    const { getByText, queryByText, getByTestId } = render(
      <MonthlyFocusCard
        focus={focus}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={WEIGHTED_LOAD}
      />
    )
    expect(getByText("Farmer's Carry")).toBeInTheDocument()
    expect(queryByText('farmers-carry')).toBeNull()
    expect(getByTestId('monthly-focus-farmers-carry')).toBeInTheDocument()
  })
})
