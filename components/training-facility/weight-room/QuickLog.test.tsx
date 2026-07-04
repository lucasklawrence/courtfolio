import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { ExerciseGoal } from '@/types/weight-room'

import { QuickLog } from './QuickLog'

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
/** A goal with no curated grip list — exercises the DB-seen fallback. */
const SHRUGS: ExerciseGoal = {
  exercise: 'shrugs',
  daily_target: 100,
  color: '#C9A268',
  kind: 'focus',
}

describe('QuickLog', () => {
  it('logs a preset rep count with a single click', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PUSHUPS]} onLog={onLog} />)
    await userEvent.click(screen.getByTestId('quick-log-pushups-10'))
    expect(onLog).toHaveBeenCalledTimes(1)
    expect(onLog).toHaveBeenCalledWith({ exercise: 'pushups', reps: 10 })
  })

  it('attaches a selected grip to a preset log (#254)', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PULLUPS]} onLog={onLog} />)
    await userEvent.selectOptions(
      screen.getByTestId('quick-log-pullups-grip'),
      'wide',
    )
    await userEvent.click(screen.getByTestId('quick-log-pullups-10'))
    expect(onLog).toHaveBeenCalledWith({
      exercise: 'pullups',
      reps: 10,
      variant: 'wide',
    })
  })

  it('exposes each exercise its curated grip list', () => {
    render(<QuickLog goals={[PULLUPS, PUSHUPS]} onLog={vi.fn()} />)
    const pullupOptions = Array.from(
      screen.getByTestId('quick-log-pullups-grip').querySelectorAll('option'),
    ).map((o) => o.value)
    // no-grip + 4 curated pull-up grips + Custom…
    expect(pullupOptions).toEqual(['', 'wide', 'close', 'neutral', 'chin-up', '__custom__'])
    const pushupOptions = Array.from(
      screen.getByTestId('quick-log-pushups-grip').querySelectorAll('option'),
    ).map((o) => o.value)
    expect(pushupOptions).toEqual([
      '',
      'standard',
      'wide',
      'diamond',
      'military',
      'shoulder',
      '__custom__',
    ])
  })

  it('logs without a grip when the dropdown is left on "no grip"', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PULLUPS]} onLog={onLog} />)
    await userEvent.click(screen.getByTestId('quick-log-pullups-10'))
    // The object must not carry a `variant` key so the write path logs
    // it as unspecified.
    expect(onLog).toHaveBeenCalledWith({ exercise: 'pullups', reps: 10 })
  })

  it('reuses the selected grip across a run of sets until changed', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PULLUPS]} onLog={onLog} />)
    await userEvent.selectOptions(screen.getByTestId('quick-log-pullups-grip'), 'close')
    await userEvent.click(screen.getByTestId('quick-log-pullups-5'))
    await userEvent.click(screen.getByTestId('quick-log-pullups-5'))
    expect(onLog).toHaveBeenNthCalledWith(1, {
      exercise: 'pullups',
      reps: 5,
      variant: 'close',
    })
    expect(onLog).toHaveBeenNthCalledWith(2, {
      exercise: 'pullups',
      reps: 5,
      variant: 'close',
    })
  })

  it('merges DB-seen grips into the dropdown so non-curated exercises can select (#254)', async () => {
    // shrugs has no curated list — the "db selection" path. A grip it's
    // been logged with before must show up as a selectable option, not
    // just be typeable.
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(
      <QuickLog
        goals={[SHRUGS]}
        variantSuggestions={{ shrugs: ['heavy'] }}
        onLog={onLog}
      />,
    )
    const options = Array.from(
      screen.getByTestId('quick-log-shrugs-grip').querySelectorAll('option'),
    ).map((o) => o.value)
    expect(options).toEqual(['', 'heavy', '__custom__'])
    await userEvent.selectOptions(screen.getByTestId('quick-log-shrugs-grip'), 'heavy')
    await userEvent.click(screen.getByTestId('quick-log-shrugs-10'))
    expect(onLog).toHaveBeenCalledWith({ exercise: 'shrugs', reps: 10, variant: 'heavy' })
  })

  it('reveals a free-text input for a brand-new grip via Custom…', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PULLUPS]} onLog={onLog} />)
    // No free-text input until Custom… is chosen.
    expect(screen.queryByTestId('quick-log-pullups-variant')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByTestId('quick-log-pullups-grip'), '__custom__')
    await userEvent.type(screen.getByTestId('quick-log-pullups-variant'), 'archer')
    await userEvent.click(screen.getByTestId('quick-log-pullups-10'))
    expect(onLog).toHaveBeenCalledWith({
      exercise: 'pullups',
      reps: 10,
      variant: 'archer',
    })
  })

  it('omits a Custom… grip that is only whitespace', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PULLUPS]} onLog={onLog} />)
    await userEvent.selectOptions(screen.getByTestId('quick-log-pullups-grip'), '__custom__')
    await userEvent.type(screen.getByTestId('quick-log-pullups-variant'), '   ')
    await userEvent.click(screen.getByTestId('quick-log-pullups-10'))
    expect(onLog).toHaveBeenCalledWith({ exercise: 'pullups', reps: 10 })
  })

  it('renders a card for each goal', () => {
    render(<QuickLog goals={[PUSHUPS, PULLUPS]} onLog={vi.fn()} />)
    expect(screen.getByText('pushups')).toBeInTheDocument()
    expect(screen.getByText('pullups')).toBeInTheDocument()
    expect(screen.getByTestId('quick-log-pullups-15')).toBeInTheDocument()
  })

  it('opens the custom form, submits the typed value, and closes', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<QuickLog goals={[PUSHUPS]} onLog={onLog} />)
    const customButtons = screen.getAllByRole('button', { name: 'Custom' })
    await userEvent.click(customButtons[0])
    const input = screen.getByLabelText(/reps/i)
    await userEvent.clear(input)
    await userEvent.type(input, '17')
    await userEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(onLog).toHaveBeenCalledWith({ exercise: 'pushups', reps: 17 })
  })

  it('seeds the custom input with lastReps when provided', async () => {
    render(
      <QuickLog
        goals={[PUSHUPS]}
        lastReps={{ pushups: 22 }}
        onLog={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText(/reps/i)).toHaveValue(22)
  })

  it('disables every preset while busy', () => {
    render(<QuickLog goals={[PUSHUPS]} onLog={vi.fn()} busy />)
    expect(screen.getByTestId('quick-log-pushups-5')).toBeDisabled()
    expect(screen.getByTestId('quick-log-pushups-25')).toBeDisabled()
  })

  it('surfaces a thrown error message inline', async () => {
    const onLog = vi.fn().mockRejectedValue(new Error('FK violation'))
    render(<QuickLog goals={[PUSHUPS]} onLog={onLog} />)
    await userEvent.click(screen.getByTestId('quick-log-pushups-10'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/FK violation/)
  })

  it('rejects non-positive custom values silently (no submit)', async () => {
    const onLog = vi.fn()
    render(<QuickLog goals={[PUSHUPS]} onLog={onLog} />)
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    const input = screen.getByLabelText(/reps/i)
    await userEvent.clear(input)
    await userEvent.type(input, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(onLog).not.toHaveBeenCalled()
  })

  it('re-seeds the Custom input when lastReps updates while the form is closed', async () => {
    // Codex called this out for #80: the row stays mounted across logs
    // (keyed by exercise), so a one-shot useState would show a stale
    // seed forever. The effect must re-sync customValue when lastReps
    // changes — but only while the form is closed, so an open edit
    // isn't yanked out from under the user.
    const { rerender } = render(
      <QuickLog
        goals={[PUSHUPS]}
        lastReps={{ pushups: 10 }}
        onLog={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    rerender(
      <QuickLog
        goals={[PUSHUPS]}
        lastReps={{ pushups: 25 }}
        onLog={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText(/reps/i)).toHaveValue(25)
  })

  it('locks the pending row while a log is in flight', async () => {
    // CodeRabbit flagged that the pending row's own buttons stayed
    // enabled, allowing concurrent double-submits on the same exercise.
    // `let resolveLog: ...` widened with an explicit cast on the call
    // site — TS strict mode doesn't track Promise-executor assignments
    // through control flow, so the eventual `resolveLog?.()` would
    // narrow to `never` without the cast.
    let resolveLog: (() => void) | null = null
    const onLog = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLog = resolve
        }),
    )
    render(<QuickLog goals={[PUSHUPS]} onLog={onLog} />)
    await userEvent.click(screen.getByTestId('quick-log-pushups-10'))
    // While the first POST is in flight, the +5 button on the same row
    // must be disabled too — not just other rows'.
    expect(screen.getByTestId('quick-log-pushups-5')).toBeDisabled()
    expect(screen.getByTestId('quick-log-pushups-10')).toBeDisabled()
    ;(resolveLog as (() => void) | null)?.()
  })

  it('keeps the Custom form mounted so aria-controls always resolves', () => {
    render(<QuickLog goals={[PUSHUPS]} onLog={vi.fn()} />)
    const customButton = screen.getByRole('button', { name: 'Custom' })
    const controls = customButton.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    // The form is in the DOM regardless of the open/closed state, so the
    // aria-controls reference resolves to a real node — Codex flagged
    // the prior conditional render as an ARIA-compliance issue.
    expect(document.getElementById(controls as string)).not.toBeNull()
  })
})
