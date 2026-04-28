import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CombineHistoryTable } from './CombineHistoryTable'
import type { Benchmark } from '@/types/movement'

/**
 * Tests for the read+CRUD history table (PRD §7.5 view 8 + §7.11).
 *
 * The component is pure presentational: callers pass `entries` plus
 * action callbacks and a dev-mode flag. The data island has its own
 * tests for the wiring (refetch, confirm() prompt, etc.); this file
 * verifies the rendering contract — sort order, empty state,
 * incomplete-row treatment, and that each action button calls back
 * with the right entry.
 */

const ENTRIES: Benchmark[] = [
  { date: '2026-04-01', bodyweight_lbs: 232.4, shuttle_5_10_5_s: 5.21 },
  { date: '2026-04-15', vertical_in: 22.5, notes: 'felt fast' },
  { date: '2026-04-08', sprint_10y_s: 1.85, is_complete: false },
]

describe('CombineHistoryTable — empty state', () => {
  it('renders an empty-state message when entries is []', () => {
    render(<CombineHistoryTable entries={[]} />)
    expect(screen.getByText(/no entries logged yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the entry count in the header (singular vs plural)', () => {
    const { rerender } = render(<CombineHistoryTable entries={[]} />)
    expect(screen.getByText(/0 entries/i)).toBeInTheDocument()
    rerender(<CombineHistoryTable entries={[ENTRIES[0]]} />)
    expect(screen.getByText(/1 entry/i)).toBeInTheDocument()
    rerender(<CombineHistoryTable entries={ENTRIES} />)
    expect(screen.getByText(/3 entries/i)).toBeInTheDocument()
  })
})

describe('CombineHistoryTable — rendering', () => {
  it('sorts rows newest-first by date', () => {
    render(<CombineHistoryTable entries={ENTRIES} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header row
    const dates = rows.map((r) => r.getAttribute('data-testid'))
    expect(dates).toEqual([
      'history-row-2026-04-15',
      'history-row-2026-04-08',
      'history-row-2026-04-01',
    ])
  })

  it('renders metric values with the configured precision and unit', () => {
    render(<CombineHistoryTable entries={[ENTRIES[0]]} />)
    const row = screen.getByTestId('history-row-2026-04-01')
    expect(within(row).getByText('232.4 lbs')).toBeInTheDocument()
    expect(within(row).getByText('5.21s')).toBeInTheDocument()
  })

  it('marks incomplete rows with the INCOMPLETE chip and dims the row', () => {
    render(<CombineHistoryTable entries={ENTRIES} />)
    const incomplete = screen.getByTestId('history-row-2026-04-08')
    expect(incomplete.getAttribute('data-incomplete')).toBe('true')
    expect(incomplete.className).toMatch(/opacity-60/)
    expect(within(incomplete).getByText(/incomplete/i)).toBeInTheDocument()

    const complete = screen.getByTestId('history-row-2026-04-01')
    expect(complete.getAttribute('data-incomplete')).toBeNull()
    expect(complete.className).not.toMatch(/opacity-60/)
  })
})

describe('CombineHistoryTable — actions', () => {
  it('hides the Actions column when showActions is false (default)', () => {
    render(<CombineHistoryTable entries={ENTRIES} />)
    expect(
      screen.queryByRole('button', { name: /edit benchmark from/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: /actions/i }),
    ).not.toBeInTheDocument()
  })

  it('renders Edit / Mark-incomplete / Delete buttons per row when showActions is true', () => {
    render(<CombineHistoryTable entries={ENTRIES} showActions />)
    expect(
      screen.getAllByRole('button', { name: /edit benchmark from/i }),
    ).toHaveLength(3)
    expect(
      screen.getAllByRole('button', { name: /delete benchmark from/i }),
    ).toHaveLength(3)
    // Mark-incomplete vs Mark-complete depends on the row's flag.
    expect(
      screen.getAllByRole('button', { name: /as incomplete$/i }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: /as complete$/i }),
    ).toHaveLength(1)
  })

  it('calls onEdit with the row entry when Edit is clicked', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<CombineHistoryTable entries={ENTRIES} showActions onEdit={onEdit} />)
    await user.click(
      screen.getByRole('button', { name: /edit benchmark from 2026-04-15/i }),
    )
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith(ENTRIES[1])
  })

  it('calls onDelete with the row entry when Delete is clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <CombineHistoryTable entries={ENTRIES} showActions onDelete={onDelete} />,
    )
    await user.click(
      screen.getByRole('button', { name: /delete benchmark from 2026-04-08/i }),
    )
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(ENTRIES[2])
  })

  it('calls onToggleComplete with the row entry, regardless of current flag', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <CombineHistoryTable
        entries={ENTRIES}
        showActions
        onToggleComplete={onToggle}
      />,
    )
    await user.click(
      screen.getByRole('button', {
        name: /mark benchmark from 2026-04-08 as complete/i,
      }),
    )
    expect(onToggle).toHaveBeenCalledWith(ENTRIES[2])

    await user.click(
      screen.getByRole('button', {
        name: /mark benchmark from 2026-04-15 as incomplete/i,
      }),
    )
    expect(onToggle).toHaveBeenCalledWith(ENTRIES[1])
  })
})
