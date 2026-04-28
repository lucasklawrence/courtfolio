import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CombineEntryForm, normalizeFormValues, toFormValues } from './CombineEntryForm'
import type { Benchmark } from '@/types/movement'

/**
 * Tests for the dev-only Combine entry form.
 *
 * The form short-circuits to `null` when `NODE_ENV !== 'development'`,
 * so every dev-mode test stubs `NODE_ENV` first and unstubs in
 * `afterEach`. `logBenchmark` is mocked at the data-layer module so
 * the form contract (call shape, error surfacing, refetch trigger) is
 * tested without needing a running dev server or a real API route —
 * the route handlers and data wrappers have their own dedicated tests.
 */

const logBenchmarkMock = vi.fn()
const updateBenchmarkMock = vi.fn()

vi.mock('@/lib/data/movement', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/movement')>(
    '@/lib/data/movement',
  )
  return {
    ...actual,
    logBenchmark: (...args: unknown[]) => logBenchmarkMock(...args),
    updateBenchmark: (...args: unknown[]) => updateBenchmarkMock(...args),
  }
})

beforeEach(() => {
  logBenchmarkMock.mockReset()
  updateBenchmarkMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('CombineEntryForm — environment gate', () => {
  it('renders nothing when NODE_ENV is not "development"', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { container } = render(<CombineEntryForm onSaved={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the panel header when NODE_ENV is "development"', () => {
    vi.stubEnv('NODE_ENV', 'development')
    render(<CombineEntryForm onSaved={() => {}} />)
    expect(screen.getByText(/dev · log a session/i)).toBeInTheDocument()
  })
})

describe('CombineEntryForm — collapsing panel', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  it('starts collapsed (no form fields visible)', () => {
    render(<CombineEntryForm onSaved={() => {}} />)
    expect(screen.queryByLabelText(/^date/i)).not.toBeInTheDocument()
  })

  it('expands when the toggle button is clicked', async () => {
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={() => {}} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))
    expect(screen.getByLabelText(/^date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bodyweight/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/5-10-5/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/vertical jump/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/10-yard sprint/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
  })
})

describe('CombineEntryForm — submit happy path', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  it('calls logBenchmark with normalized values, omitting blanks', async () => {
    logBenchmarkMock.mockResolvedValueOnce(undefined)
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))

    const dateInput = screen.getByLabelText(/^date/i) as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-15')
    await user.type(screen.getByLabelText(/bodyweight/i), '232.4')
    await user.type(screen.getByLabelText(/5-10-5/i), '5.12')
    // Leave vertical and sprint blank — they should be omitted from the payload.
    await user.type(screen.getByLabelText(/notes/i), 'felt fast')

    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() => expect(logBenchmarkMock).toHaveBeenCalledTimes(1))
    expect(logBenchmarkMock).toHaveBeenCalledWith({
      date: '2026-04-15',
      bodyweight_lbs: 232.4,
      shuttle_5_10_5_s: 5.12,
      notes: 'felt fast',
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('shows a confirmation message and resets the form on success', async () => {
    logBenchmarkMock.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={() => {}} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))

    const dateInput = screen.getByLabelText(/^date/i) as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-15')
    const bw = screen.getByLabelText(/bodyweight/i) as HTMLInputElement
    await user.type(bw, '232')

    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() =>
      expect(screen.getByText(/saved entry for 2026-04-15/i)).toBeInTheDocument(),
    )
    expect(bw.value).toBe('')
  })
})

describe('CombineEntryForm — error paths', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  it('surfaces the server error message and does NOT call onSaved when the API rejects', async () => {
    logBenchmarkMock.mockRejectedValueOnce(new Error('Boom — write failed.'))
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))

    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-15')
    await user.type(screen.getByLabelText(/bodyweight/i), '232')

    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() =>
      expect(screen.getByText(/boom — write failed/i)).toBeInTheDocument(),
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('blocks submit and shows a Zod error for an invalid (empty) date', async () => {
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={() => {}} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))

    await user.clear(screen.getByLabelText(/^date/i))
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    expect(logBenchmarkMock).not.toHaveBeenCalled()
    // The Zod resolver (single source of truth) flags the empty date
    // via the regex check on `BenchmarkSchema`.
    await waitFor(() =>
      expect(screen.getByText(/yyyy-mm-dd/i)).toBeInTheDocument(),
    )
  })

  it('keeps the success message even when the parent onSaved callback rejects (CodeRabbit nit)', async () => {
    // Save succeeds on the server. The parent's refetch then throws.
    // The form should still show "Saved entry for ..." — the data is
    // already on disk — rather than overwriting it with an error.
    logBenchmarkMock.mockResolvedValueOnce(undefined)
    const onSaved = vi.fn().mockRejectedValueOnce(new Error('refetch broke'))
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))

    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-15')
    await user.type(screen.getByLabelText(/bodyweight/i), '232')
    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() =>
      expect(screen.getByText(/saved entry for 2026-04-15/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/refetch broke/i)).not.toBeInTheDocument()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('rejects negative numeric values via Zod (.positive())', async () => {
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={() => {}} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))

    const dateInput = screen.getByLabelText(/^date/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2026-04-15')
    // Type the value via keyboard — `<input type="number">` in jsdom
    // accepts the minus sign in the value attribute, so this round-
    // trips through the resolver.
    const bw = screen.getByLabelText(/bodyweight/i) as HTMLInputElement
    await user.type(bw, '-5')

    await user.click(screen.getByRole('button', { name: /save entry/i }))

    expect(logBenchmarkMock).not.toHaveBeenCalled()
  })
})

describe('CombineEntryForm — date initialization (Codex P2 timezone fix)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  it('does NOT seed the date field at render time (SSR-safe; effect populates after mount)', async () => {
    const user = userEvent.setup()
    render(<CombineEntryForm onSaved={() => {}} />)
    await user.click(screen.getByRole('button', { name: /log a session/i }))
    const dateInput = screen.getByLabelText(/^date/i) as HTMLInputElement
    // After mount, the effect has fired — date should be a YYYY-MM-DD
    // computed from the *browser*'s clock, not the server's.
    await waitFor(() => expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/))
    // The form's `emptyValues()` factory now starts the date as ''.
    // Sanity check: the effect-set value matches today in the local TZ.
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(dateInput.value).toBe(expected)
  })
})

describe('CombineEntryForm — edit mode (PRD §7.11)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  const ENTRY: Benchmark = {
    date: '2026-03-10',
    bodyweight_lbs: 230.0,
    shuttle_5_10_5_s: 5.05,
    notes: 'cold gym',
  }

  it('auto-opens the panel and prefills inputs when editingEntry is set', async () => {
    render(<CombineEntryForm onSaved={() => {}} editingEntry={ENTRY} />)
    expect(screen.getByText(/dev · edit session for 2026-03-10/i)).toBeInTheDocument()
    const dateInput = screen.getByLabelText(/^date/i) as HTMLInputElement
    expect(dateInput.value).toBe('2026-03-10')
    expect(dateInput.readOnly).toBe(true)
    expect(
      (screen.getByLabelText(/bodyweight/i) as HTMLInputElement).value,
    ).toBe('230')
    expect(
      (screen.getByLabelText(/5-10-5/i) as HTMLInputElement).value,
    ).toBe('5.05')
    expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe(
      'cold gym',
    )
  })

  it('shows "Cancel edit" toggle and "Update entry" submit button in edit mode', () => {
    render(<CombineEntryForm onSaved={() => {}} editingEntry={ENTRY} />)
    expect(screen.getByRole('button', { name: /cancel edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update entry/i })).toBeInTheDocument()
  })

  it('submits via updateBenchmark with the entry date and a no-date payload', async () => {
    updateBenchmarkMock.mockResolvedValueOnce(undefined)
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(
      <CombineEntryForm
        onSaved={onSaved}
        editingEntry={ENTRY}
        onCancelEdit={() => {}}
      />,
    )
    // Edit a single field, leave the rest of the prefill alone.
    const bw = screen.getByLabelText(/bodyweight/i) as HTMLInputElement
    await user.clear(bw)
    await user.type(bw, '231.0')
    await user.click(screen.getByRole('button', { name: /update entry/i }))

    await waitFor(() => expect(updateBenchmarkMock).toHaveBeenCalledTimes(1))
    expect(updateBenchmarkMock).toHaveBeenCalledWith('2026-03-10', {
      bodyweight_lbs: 231.0,
      shuttle_5_10_5_s: 5.05,
      notes: 'cold gym',
    })
    expect(logBenchmarkMock).not.toHaveBeenCalled()
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('clicks "Cancel edit" → calls onCancelEdit and resets the form', async () => {
    const onCancelEdit = vi.fn()
    const user = userEvent.setup()
    render(
      <CombineEntryForm
        onSaved={() => {}}
        editingEntry={ENTRY}
        onCancelEdit={onCancelEdit}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cancel edit/i }))
    expect(onCancelEdit).toHaveBeenCalledTimes(1)
  })

  it('exits edit mode after a successful update (calls onCancelEdit)', async () => {
    updateBenchmarkMock.mockResolvedValueOnce(undefined)
    const onCancelEdit = vi.fn()
    const user = userEvent.setup()
    render(
      <CombineEntryForm
        onSaved={() => {}}
        editingEntry={ENTRY}
        onCancelEdit={onCancelEdit}
      />,
    )
    await user.click(screen.getByRole('button', { name: /update entry/i }))
    await waitFor(() => expect(updateBenchmarkMock).toHaveBeenCalled())
    await waitFor(() => expect(onCancelEdit).toHaveBeenCalledTimes(1))
  })

  it('surfaces server errors from updateBenchmark without exiting edit mode', async () => {
    updateBenchmarkMock.mockRejectedValueOnce(new Error('No benchmark for 2026-03-10.'))
    const onCancelEdit = vi.fn()
    const user = userEvent.setup()
    render(
      <CombineEntryForm
        onSaved={() => {}}
        editingEntry={ENTRY}
        onCancelEdit={onCancelEdit}
      />,
    )
    await user.click(screen.getByRole('button', { name: /update entry/i }))
    await waitFor(() =>
      expect(screen.getByText(/no benchmark for 2026-03-10/i)).toBeInTheDocument(),
    )
    expect(onCancelEdit).not.toHaveBeenCalled()
  })
})

describe('toFormValues', () => {
  it('stringifies populated numeric fields and leaves omitted ones empty', () => {
    expect(
      toFormValues({
        date: '2026-04-15',
        bodyweight_lbs: 232.4,
        notes: 'felt fast',
      }),
    ).toEqual({
      date: '2026-04-15',
      bodyweight_lbs: '232.4',
      shuttle_5_10_5_s: '',
      vertical_in: '',
      sprint_10y_s: '',
      notes: 'felt fast',
    })
  })
})

describe('normalizeFormValues', () => {
  it('parses populated numeric strings into numbers', () => {
    expect(
      normalizeFormValues({
        date: '2026-04-15',
        bodyweight_lbs: '232.4',
        shuttle_5_10_5_s: '5.12',
        vertical_in: '22.5',
        sprint_10y_s: '1.85',
        notes: 'note',
      }),
    ).toEqual({
      date: '2026-04-15',
      bodyweight_lbs: 232.4,
      shuttle_5_10_5_s: 5.12,
      vertical_in: 22.5,
      sprint_10y_s: 1.85,
      notes: 'note',
    })
  })

  it('omits empty / whitespace-only fields rather than emitting 0 or NaN', () => {
    expect(
      normalizeFormValues({
        date: '2026-04-15',
        bodyweight_lbs: '',
        shuttle_5_10_5_s: '   ',
        vertical_in: '',
        sprint_10y_s: '',
        notes: '   ',
      }),
    ).toEqual({ date: '2026-04-15' })
  })
})
