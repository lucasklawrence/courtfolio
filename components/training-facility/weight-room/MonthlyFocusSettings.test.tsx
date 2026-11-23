import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MonthlyFocus, WeightRoomExercise } from '@/types/weight-room'

import { MonthlyFocusSettings } from './MonthlyFocusSettings'

/**
 * Coverage for the monthly-focus Settings editor (#384): the active /
 * upcoming / past split, the create payload and its client-side validation,
 * and delete-with-confirm. `fetch` is stubbed per test; the admin routes have
 * their own coverage under `app/api/admin/weight-room/monthly-focus`.
 */

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

/** Mid-afternoon Pacific on 2026-08-15, so the day key is unambiguous. */
const NOW = new Date('2026-08-15T21:00:00Z')

const ACTIVE: MonthlyFocus = {
  id: '00000000-0000-4000-8000-000000000001',
  exercise: 'shrugs',
  display_name: 'Shrugs',
  daily_target: 60,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-08-01',
  end_date: '2026-08-31',
}

const UPCOMING: MonthlyFocus = {
  id: '00000000-0000-4000-8000-000000000002',
  exercise: 'lunges',
  daily_target: 40,
  target_kind: 'reps',
  color: '#0EA5A1',
  category: 'lower',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
}

const PAST: MonthlyFocus = {
  id: '00000000-0000-4000-8000-000000000003',
  exercise: 'dips',
  daily_target: 5,
  target_kind: 'sets',
  color: '#EA580C',
  category: 'upper',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

const EXERCISES: WeightRoomExercise[] = [
  { slug: 'pushups', display_name: 'Pushups', equipment: 'bodyweight', muscle_group: 'chest' },
  { slug: 'goblet-squat', display_name: 'Goblet Squat', equipment: 'dumbbell', muscle_group: 'legs' },
] as WeightRoomExercise[]

function section(name: RegExp): HTMLElement {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  refreshMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MonthlyFocusSettings', () => {
  it('splits focuses into active, upcoming and past against today in Pacific', () => {
    render(
      <MonthlyFocusSettings
        initialFocuses={[PAST, UPCOMING, ACTIVE]}
        exercises={EXERCISES}
        now={NOW}
      />
    )
    expect(within(section(/^active$/i)).getByText('Shrugs')).toBeInTheDocument()
    expect(within(section(/^upcoming$/i)).getByText('lunges')).toBeInTheDocument()
    const past = section(/^past$/i)
    expect(within(past).getByText('dips')).toBeInTheDocument()
    expect(within(past).getByText('5 sets/day')).toBeInTheDocument()
  })

  it('shows each bucket’s empty state when there are no focuses', () => {
    render(<MonthlyFocusSettings initialFocuses={[]} exercises={EXERCISES} now={NOW} />)
    expect(screen.getByText(/no focus running today/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing queued/i)).toBeInTheDocument()
    expect(screen.getByText(/no finished focuses yet/i)).toBeInTheDocument()
  })

  it('POSTs a validated focus and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<MonthlyFocusSettings initialFocuses={[]} exercises={EXERCISES} now={NOW} />)
    await user.selectOptions(screen.getByRole('combobox', { name: /exercise/i }), 'goblet-squat')
    const target = screen.getByRole('spinbutton', { name: /daily target/i })
    await user.clear(target)
    await user.type(target, '30')
    await user.type(screen.getByLabelText(/ends/i), '2026-09-14')
    await user.click(screen.getByRole('button', { name: /add focus/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/weight-room/monthly-focus')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse(init.body as string)).toEqual({
      exercise: 'goblet-squat',
      daily_target: 30,
      target_kind: 'reps',
      color: '#C9A268',
      // A legs movement defaults to the lower lane.
      category: 'lower',
      start_date: '2026-08-15',
      end_date: '2026-09-14',
    })
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('blocks an end date before the start date without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<MonthlyFocusSettings initialFocuses={[]} exercises={EXERCISES} now={NOW} />)
    await user.selectOptions(screen.getByRole('combobox', { name: /exercise/i }), 'pushups')
    const end = screen.getByLabelText(/ends/i)
    await user.type(end, '2026-08-01')
    await user.click(screen.getByRole('button', { name: /add focus/i }))

    // The end input's `min` tracks the start date, so constraint validation
    // stops the submit before the schema check or the network.
    expect(end).toBeInvalid()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the form input and shows the API error when the create fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to create monthly focus: boom' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<MonthlyFocusSettings initialFocuses={[]} exercises={EXERCISES} now={NOW} />)
    const picker = screen.getByRole('combobox', { name: /exercise/i })
    await user.selectOptions(picker, 'pushups')
    await user.type(screen.getByLabelText(/ends/i), '2026-08-31')
    await user.click(screen.getByRole('button', { name: /add focus/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/boom/)
    expect(picker).toHaveValue('pushups')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('DELETEs a focus by id after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<MonthlyFocusSettings initialFocuses={[ACTIVE]} exercises={EXERCISES} now={NOW} />)
    await user.click(screen.getByRole('button', { name: /delete the shrugs focus/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/weight-room/monthly-focus/${ACTIVE.id}`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('does nothing when the delete is not confirmed', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<MonthlyFocusSettings initialFocuses={[ACTIVE]} exercises={EXERCISES} now={NOW} />)
    await user.click(screen.getByRole('button', { name: /delete the shrugs focus/i }))

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
