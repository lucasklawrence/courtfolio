'use client'

import { useEffect, useId, useRef, useState, type JSX } from 'react'

import { MAX_MAX_HR, MIN_MAX_HR, parseMaxHr, useMaxHr } from '@/utils/useMaxHr'

/** Props for {@link MaxHrControl}. */
export interface MaxHrControlProps {
  /**
   * Fires whenever the persisted max HR changes (initial read, user save, or
   * reset). The parent should hold this value in state and pass it to
   * `dailyTrimpSeries`. Called with {@link import('@/constants/hr-zones').DEFAULT_MAX_HR}
   * pre-hydration.
   */
  onChange?: (maxHr: number) => void
}

/**
 * Small inline control letting the user override the max-HR used by the
 * Training Load chart. Sits in the chart-card header. Two states:
 *
 * - **Display:** badge showing the current BPM, a "(default)" hint when no
 *   user value is set, and a pencil affordance to enter edit mode.
 * - **Edit:** a number input plus Save / Cancel; Enter saves, Esc cancels.
 *
 * The control owns its own {@link useMaxHr} instance because callers only need
 * the resolved value via `onChange`. Keeps the parent view slim and matches
 * the pattern used elsewhere where small persistent settings live next to the
 * thing they affect rather than in a global panel.
 *
 * @param props - See {@link MaxHrControlProps}.
 */
export function MaxHrControl({ onChange }: MaxHrControlProps): JSX.Element {
  const { maxHr, ready, isUserSet, setMaxHr, reset } = useMaxHr()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(String(maxHr))
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    onChange?.(maxHr)
  }, [maxHr, onChange])

  useEffect(() => {
    if (!editing) setDraft(String(maxHr))
  }, [maxHr, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit(): void {
    const parsed = parseMaxHr(draft)
    if (parsed === null) {
      setError(`Enter a number between ${MIN_MAX_HR} and ${MAX_MAX_HR}`)
      return
    }
    setMaxHr(parsed)
    setError(null)
    setEditing(false)
  }

  function cancel(): void {
    setDraft(String(maxHr))
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#0a0a0a]"
        >
          Max HR
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="number"
          inputMode="numeric"
          min={MIN_MAX_HR}
          max={MAX_MAX_HR}
          step={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="w-16 rounded-md border border-[#0a0a0a]/20 bg-white px-2 py-1 text-center font-mono text-sm text-[#0a0a0a] focus:border-[#0a0a0a]/50 focus:outline-none"
        />
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#404040]">
          BPM
        </span>
        <button
          type="button"
          onClick={commit}
          className="rounded-md bg-[#0a0a0a] px-2 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#f5f1e6] transition hover:bg-[#0a0a0a]/80"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-[#0a0a0a]/20 px-2 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#0a0a0a] transition hover:bg-[#0a0a0a]/10"
        >
          Cancel
        </button>
        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="basis-full font-mono text-[0.65rem] uppercase tracking-[0.18em] text-red-700"
          >
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={!ready}
        aria-label={`Edit max heart rate (currently ${maxHr} BPM${isUserSet ? '' : ', default'})`}
        className="group inline-flex items-center gap-1.5 rounded-full border border-[#0a0a0a]/15 bg-white/60 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#0a0a0a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>Max HR</span>
        <span className="font-mono text-sm">{maxHr}</span>
        <span className="text-[0.6rem] tracking-[0.12em] text-[#404040]">BPM</span>
        {!isUserSet ? (
          <span className="text-[0.55rem] tracking-[0.12em] text-[#737373]">(default)</span>
        ) : null}
        <span aria-hidden="true" className="text-[0.7rem] text-[#404040] group-hover:text-[#0a0a0a]">
          ✎
        </span>
      </button>
      {isUserSet ? (
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[#404040] underline-offset-2 transition hover:text-[#0a0a0a] hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  )
}
