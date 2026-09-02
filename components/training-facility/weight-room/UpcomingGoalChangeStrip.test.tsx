import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { ExerciseGoal } from '@/types/weight-room'

import { UpcomingGoalChangeStrip } from './UpcomingGoalChangeStrip'

const TODAY = '2026-08-15'

function goal(
  exercise: string,
  history: { daily_target: number; effective_from: string }[],
  overrides: Partial<ExerciseGoal> = {}
): ExerciseGoal {
  return {
    exercise,
    daily_target: 30,
    color: '#0EA5A1',
    target_history: history,
    ...overrides,
  }
}

describe('UpcomingGoalChangeStrip (#371)', () => {
  it('renders nothing when no change is queued', () => {
    const { container } = render(
      <UpcomingGoalChangeStrip
        goals={[goal('pullups', [{ daily_target: 30, effective_from: '2026-01-01' }])]}
        todayKey={TODAY}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('announces a scheduled change with its target and date', () => {
    const { getByTestId } = render(
      <UpcomingGoalChangeStrip
        goals={[
          goal('pullups', [
            { daily_target: 30, effective_from: '2026-01-01' },
            { daily_target: 50, effective_from: '2026-09-01' },
          ]),
        ]}
        todayKey={TODAY}
      />
    )
    const entry = getByTestId('upcoming-goal-change-pullups')
    expect(entry.textContent).toContain('30')
    expect(entry.textContent).toContain('50')
    expect(getByTestId('upcoming-goal-change-pullups-date').textContent).toContain('Sep')
  })

  it('stops announcing once the change is in effect', () => {
    const { container } = render(
      <UpcomingGoalChangeStrip
        goals={[
          goal('pullups', [
            { daily_target: 30, effective_from: '2026-01-01' },
            { daily_target: 50, effective_from: '2026-09-01' },
          ]),
        ]}
        todayKey="2026-09-01"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('orders multiple changes soonest first', () => {
    const { getByTestId } = render(
      <UpcomingGoalChangeStrip
        goals={[
          goal('pullups', [
            { daily_target: 30, effective_from: '2026-01-01' },
            { daily_target: 50, effective_from: '2026-12-01' },
          ]),
          goal('pushups', [
            { daily_target: 100, effective_from: '2026-01-01' },
            { daily_target: 120, effective_from: '2026-09-01' },
          ]),
        ]}
        todayKey={TODAY}
      />
    )
    const strip = getByTestId('upcoming-goal-change-strip')
    const order = Array.from(strip.querySelectorAll('[data-testid^="upcoming-goal-change-"]'))
      .map(e => e.getAttribute('data-testid'))
      .filter(id => id !== null && !id.endsWith('-date'))
    expect(order[0]).toBe('upcoming-goal-change-pushups')
    expect(order[1]).toBe('upcoming-goal-change-pullups')
  })

  it('uses the catalog label when the goal carries one', () => {
    const { getByTestId } = render(
      <UpcomingGoalChangeStrip
        goals={[
          goal(
            'barbell-row',
            [
              { daily_target: 30, effective_from: '2026-01-01' },
              { daily_target: 50, effective_from: '2026-09-01' },
            ],
            { display_name: 'Barbell Row' }
          ),
        ]}
        todayKey={TODAY}
      />
    )
    expect(getByTestId('upcoming-goal-change-barbell-row').textContent).toContain('Barbell Row')
  })
})
