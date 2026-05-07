import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { SetList } from './SetList'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}

function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    logged_at: '2026-05-07T09:30:00',
    exercise: 'pushups',
    reps: 10,
    ...overrides,
  }
}

describe('SetList', () => {
  it('renders an empty card when no sets logged today', () => {
    render(<SetList setsToday={[]} goalsByExercise={{ pushups: PUSHUPS }} />)
    expect(screen.getByTestId('set-list-empty')).toBeInTheDocument()
    expect(screen.getByText(/no sets logged yet today/i)).toBeInTheDocument()
  })

  it('renders one row per logged set with rep count', () => {
    render(
      <SetList
        setsToday={[
          set({ id: 'a', reps: 10 }),
          set({ id: 'b', reps: 15 }),
        ]}
        goalsByExercise={{ pushups: PUSHUPS }}
      />,
    )
    expect(screen.getByTestId('set-row-a')).toBeInTheDocument()
    expect(screen.getByTestId('set-row-b')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('shows most recent set first (reverses input order)', () => {
    render(
      <SetList
        setsToday={[
          set({ id: 'a', reps: 5, logged_at: '2026-05-07T08:00:00' }),
          set({ id: 'b', reps: 10, logged_at: '2026-05-07T11:00:00' }),
          set({ id: 'c', reps: 15, logged_at: '2026-05-07T17:00:00' }),
        ]}
        goalsByExercise={{ pushups: PUSHUPS }}
      />,
    )
    const rows = screen.getAllByTestId(/set-row-/)
    expect(rows[0]).toHaveAttribute('data-testid', 'set-row-c')
    expect(rows[2]).toHaveAttribute('data-testid', 'set-row-a')
  })

  it('hides delete buttons when onDelete is not provided', () => {
    render(<SetList setsToday={[set()]} goalsByExercise={{ pushups: PUSHUPS }} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('calls onDelete when the trash button is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const target = set({ id: 'x', reps: 10 })
    render(
      <SetList
        setsToday={[target]}
        goalsByExercise={{ pushups: PUSHUPS }}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /delete set of 10 pushups/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(target)
  })

  it('surfaces a delete failure inline', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('boom'))
    render(
      <SetList
        setsToday={[set({ id: 'x' })]}
        goalsByExercise={{ pushups: PUSHUPS }}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/boom/)
  })
})
