import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      screen.getByText(/no exercises yet — add one below to start logging sets\./i)
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

describe('StrengthSettings — scheduled target changes (#371)', () => {
  const SCHEDULED: ExerciseGoal = {
    exercise: 'pullups',
    daily_target: 30,
    color: '#0EA5A1',
    target_history: [
      { daily_target: 30, effective_from: '2026-01-01' },
      { daily_target: 50, effective_from: '2099-09-01' },
    ],
  }

  it('shows a queued change on the goal row', () => {
    // Dated far in the future so the assertion can't age out.
    const { getByTestId } = render(<StrengthSettings initialGoals={[SCHEDULED]} />)
    const row = getByTestId('goal-scheduled-pullups')
    expect(row.textContent).toContain('30')
    expect(row.textContent).toContain('50')
  })

  it('shows nothing when every entry is already in effect', () => {
    const { queryByTestId } = render(
      <StrengthSettings
        initialGoals={[
          {
            exercise: 'pullups',
            daily_target: 30,
            color: '#0EA5A1',
            target_history: [{ daily_target: 30, effective_from: '2026-01-01' }],
          },
        ]}
      />
    )
    expect(queryByTestId('goal-scheduled-pullups')).toBeNull()
  })

  it('cancels a queued change through the targets endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<StrengthSettings initialGoals={[SCHEDULED]} />)

    await userEvent.click(screen.getByRole('button', { name: /cancel the scheduled/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/admin/weight-room/goals/pullups/targets/2099-09-01'
    )
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
  })

  it('sends effective_from when a date is chosen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <StrengthSettings
        initialGoals={[{ exercise: 'pullups', daily_target: 30, color: '#0EA5A1' }]}
      />
    )

    // The add-goal form has a target input too; the goal row's comes first.
    const targetInput = screen.getAllByRole('spinbutton')[0]
    await userEvent.clear(targetInput)
    await userEvent.type(targetInput, '50')
    fireEvent.change(screen.getByLabelText(/effective date for the pullups target/i), {
      target: { value: '2099-09-01' },
    })
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toMatchObject({ daily_target: 50, effective_from: '2099-09-01' })
  })
})

describe('StrengthSettings — scheduling guards (#371 review)', () => {
  const PULLUPS: ExerciseGoal = { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' }

  async function scheduleFutureTarget(value: string) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<StrengthSettings initialGoals={[PULLUPS]} />)

    const targetInput = screen.getAllByRole('spinbutton')[0]
    await userEvent.clear(targetInput)
    await userEvent.type(targetInput, value)
    fireEvent.change(screen.getByLabelText(/effective date for the pullups target/i), {
      target: { value: '2099-09-01' },
    })
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    return { fetchMock, targetInput }
  }

  it('snaps the target back to what is in effect after scheduling', async () => {
    // Otherwise the row keeps showing the future number with Save enabled, and
    // the next save posts it with no date — applying it today and defeating
    // the schedule entirely.
    const { targetInput } = await scheduleFutureTarget('50')
    await waitFor(() => expect(targetInput).toHaveValue(30))
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('does not re-post the scheduled target on a later save', async () => {
    const { fetchMock } = await scheduleFutureTarget('50')
    // Nudge the colour and save again — the payload must carry today's target.
    // jsdom lowercases a color input's value, so select by type rather than
    // by display value.
    const colorInput = document.querySelectorAll('input[type="color"]')[0]
    fireEvent.change(colorInput, { target: { value: '#123456' } })
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(second).toMatchObject({ daily_target: 30, color: '#123456' })
    expect(second).not.toHaveProperty('effective_from')
  })

  it('enables Save for a date-only change, so a reversion can be queued', async () => {
    // Target already equals today's value; only the date differs. The API
    // records it because the value in effect on that future date is different.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<StrengthSettings initialGoals={[PULLUPS]} />)

    const save = screen.getByRole('button', { name: /^save$/i })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/effective date for the pullups target/i), {
      target: { value: '2099-10-01' },
    })
    expect(save).toBeEnabled()

    await userEvent.click(save)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      daily_target: 30,
      effective_from: '2099-10-01',
    })
  })
})
