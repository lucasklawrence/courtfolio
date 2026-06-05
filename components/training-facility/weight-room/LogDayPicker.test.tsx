import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LogDayPicker } from './LogDayPicker'

const TODAY = '2026-06-04'
const PAST = '2026-05-25'

describe('LogDayPicker', () => {
  it('renders a date input capped at today', () => {
    render(
      <LogDayPicker selectedDay={TODAY} todayKey={TODAY} onSelectDay={vi.fn()} />,
    )
    const input = screen.getByTestId('log-day-input')
    expect(input).toHaveValue(TODAY)
    expect(input).toHaveAttribute('max', TODAY)
  })

  it('hides the reset chip and indicator when viewing today', () => {
    render(
      <LogDayPicker selectedDay={TODAY} todayKey={TODAY} onSelectDay={vi.fn()} />,
    )
    expect(screen.queryByTestId('log-day-reset')).not.toBeInTheDocument()
    expect(screen.queryByTestId('log-day-indicator')).not.toBeInTheDocument()
  })

  it('forwards a picked past day to onSelectDay', () => {
    const onSelectDay = vi.fn()
    render(
      <LogDayPicker selectedDay={TODAY} todayKey={TODAY} onSelectDay={onSelectDay} />,
    )
    fireEvent.change(screen.getByTestId('log-day-input'), {
      target: { value: PAST },
    })
    expect(onSelectDay).toHaveBeenCalledWith(PAST)
  })

  it('swallows future dates and cleared input', () => {
    const onSelectDay = vi.fn()
    render(
      <LogDayPicker selectedDay={TODAY} todayKey={TODAY} onSelectDay={onSelectDay} />,
    )
    const input = screen.getByTestId('log-day-input')
    fireEvent.change(input, { target: { value: '2026-06-05' } })
    fireEvent.change(input, { target: { value: '' } })
    // 5-digit year would defeat the lexicographic future-date compare if
    // the shape weren't pinned first.
    fireEvent.change(input, { target: { value: '10000-01-01' } })
    expect(onSelectDay).not.toHaveBeenCalled()
  })

  it('shows a viewing indicator while backfilling', () => {
    render(
      <LogDayPicker selectedDay={PAST} todayKey={TODAY} onSelectDay={vi.fn()} />,
    )
    const indicator = screen.getByTestId('log-day-indicator')
    // 2026-05-25 is a Monday.
    expect(indicator).toHaveTextContent(/Mon/)
    expect(indicator).toHaveTextContent(/logged to this day/)
  })

  it('resets to today via the Back to today chip', async () => {
    const onSelectDay = vi.fn()
    render(
      <LogDayPicker selectedDay={PAST} todayKey={TODAY} onSelectDay={onSelectDay} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /back to today/i }))
    expect(onSelectDay).toHaveBeenCalledWith(TODAY)
  })
})
