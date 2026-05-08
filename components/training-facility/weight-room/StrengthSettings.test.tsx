import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { ExerciseGoal } from '@/types/weight-room'

import { StrengthSettings } from './StrengthSettings'

/**
 * Smoke coverage for the Weight Room Settings client island (#181).
 *
 * `next/navigation` is mocked so the `router.refresh()` post-mutation
 * call doesn't blow up under jsdom. `fetch` is mocked per-test to
 * isolate the form/POST contract — the admin API routes have their
 * own coverage in `app/api/admin/weight-room/**`.
 */

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}

const PULLUPS: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 30,
  color: '#0EA5A1',
}

beforeEach(() => {
  refreshMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StrengthSettings', () => {
  it('renders an editable row for each goal', () => {
    render(<StrengthSettings initialGoals={[PUSHUPS, PULLUPS]} />)
    expect(screen.getByText('pushups')).toBeInTheDocument()
    expect(screen.getByText('pullups')).toBeInTheDocument()
    // Two save buttons (one per row), one Add button.
    expect(screen.getAllByRole('button', { name: /^save$/i })).toHaveLength(2)
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
  })

  it('shows the empty-state copy and the add form when no goals exist', () => {
    render(<StrengthSettings initialGoals={[]} />)
    expect(
      screen.getByText(/no exercises yet — add one below to start logging sets\./i),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^save$/i })).toHaveLength(0)
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
  })

  it('POSTs the goal payload and refreshes when the add form is submitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<StrengthSettings initialGoals={[]} />)
    const exerciseInput = screen.getByPlaceholderText(/dips/i)
    await userEvent.type(exerciseInput, 'dips')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/weight-room/goals')
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ exercise: 'dips', daily_target: 50, color: '#EA580C' })
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('surfaces a server error message inline on a failed save', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Exercise already exists' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<StrengthSettings initialGoals={[]} />)
    await userEvent.type(screen.getByPlaceholderText(/dips/i), 'dips')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/exercise already exists/i)
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
