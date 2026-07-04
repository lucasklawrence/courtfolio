import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { VariantBreakdown } from './VariantBreakdown'

const PULLUPS: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 30,
  color: '#0EA5A1',
}

/** Assemble a {@link StrengthSet} with sensible defaults. */
function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    logged_at: '2026-05-07T13:00:00',
    exercise: 'pullups',
    reps: 10,
    ...overrides,
  }
}

describe('VariantBreakdown', () => {
  it('renders nothing until at least one set carries a variant', () => {
    const { container } = render(
      <VariantBreakdown sets={[set(), set()]} goal={PULLUPS} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('breaks volume down by variant with reps and percentages', () => {
    render(
      <VariantBreakdown
        sets={[
          set({ reps: 30, variant: 'wide' }),
          set({ reps: 30, variant: 'wide' }),
          set({ reps: 30, variant: 'close' }),
          set({ reps: 30 }),
        ]}
        goal={PULLUPS}
      />,
    )
    expect(screen.getByTestId('variant-breakdown-pullups')).toBeInTheDocument()
    // wide = 60/120 = 50%, close = 25%, unspecified = 25%.
    expect(screen.getByTestId('variant-breakdown-pullups-wide')).toHaveTextContent(
      /wide\s*60\s*·\s*50%/,
    )
    expect(screen.getByTestId('variant-breakdown-pullups-close')).toHaveTextContent(
      /close\s*30\s*·\s*25%/,
    )
    expect(
      screen.getByTestId('variant-breakdown-pullups-unspecified'),
    ).toHaveTextContent(/unspecified\s*30\s*·\s*25%/)
  })

  it('ignores sets for other exercises', () => {
    render(
      <VariantBreakdown
        sets={[
          set({ reps: 10, variant: 'wide' }),
          set({ exercise: 'pushups', reps: 100, variant: 'diamond' }),
        ]}
        goal={PULLUPS}
      />,
    )
    // Only the pullups/wide set counts: 100% wide, no diamond bucket.
    expect(screen.getByTestId('variant-breakdown-pullups-wide')).toHaveTextContent(
      /wide\s*10\s*·\s*100%/,
    )
    expect(
      screen.queryByTestId('variant-breakdown-pullups-diamond'),
    ).not.toBeInTheDocument()
  })

  it('exposes the split to assistive tech via the bar aria-label', () => {
    render(
      <VariantBreakdown
        sets={[set({ reps: 10, variant: 'wide' }), set({ reps: 10 })]}
        goal={PULLUPS}
      />,
    )
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /pullups by variant: wide 50%, unspecified 50%/,
    )
  })
})
