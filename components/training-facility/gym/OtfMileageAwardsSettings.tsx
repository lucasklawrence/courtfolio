'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent, type JSX } from 'react'

import type { OtfMileageAward } from '@/types/otf'

/** Props for {@link OtfMileageAwardsSettings}. */
export interface OtfMileageAwardsSettingsProps {
  /**
   * The milestone ladder as read by the server component on first paint. The
   * editor hydrates from this list; mutations refresh via `router.refresh()`
   * so the next render comes from a fresh server fetch (no client cache to
   * invalidate).
   */
  initialAwards: readonly OtfMileageAward[]
}

/** Accent applied to a new tier's color picker before the admin changes it — OTF orange. */
const DEFAULT_NEW_COLOR = '#F97316'

/**
 * Admin-only editor for the OTF monthly-mileage milestone ladder (#321).
 * Renders each existing tier as an editable row (label + miles + color) and a
 * small form to add a new tier. Each mutation hits the admin API routes under
 * `/api/admin/otf/mileage-awards`; on success the parent page's server data
 * refreshes via `router.refresh()` so the ladder re-reads without a manual
 * reload. Mirrors the Weight Room `StrengthSettings` editor.
 */
export function OtfMileageAwardsSettings({
  initialAwards,
}: OtfMileageAwardsSettingsProps): JSX.Element {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function refresh(): void {
    startTransition(() => {
      router.refresh()
    })
  }

  async function createAward(body: {
    label: string
    miles: number
    color: string
  }): Promise<boolean> {
    setError(null)
    const res = await fetch('/api/admin/otf/mileage-awards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? `Save failed (${res.status})`)
      return false
    }
    refresh()
    return true
  }

  async function updateAward(
    id: string,
    body: { label: string; miles: number; color: string },
  ): Promise<void> {
    setError(null)
    const res = await fetch(`/api/admin/otf/mileage-awards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? `Save failed (${res.status})`)
      return
    }
    refresh()
  }

  async function deleteAward(award: OtfMileageAward): Promise<void> {
    setError(null)
    const ok = window.confirm(`Delete the "${award.label}" milestone?`)
    if (!ok) return
    const res = await fetch(`/api/admin/otf/mileage-awards/${encodeURIComponent(award.id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? `Delete failed (${res.status})`)
      return
    }
    refresh()
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <section aria-label="Existing milestones">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Milestones
        </h2>
        {initialAwards.length === 0 ? (
          <p className="mt-3 text-sm text-[#e8d5be]/70">
            No milestones yet — add one below to start lighting up badges.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {initialAwards.map((award) => (
              <AwardRow
                key={award.id}
                award={award}
                disabled={isPending}
                onSave={updateAward}
                onDelete={deleteAward}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Add a milestone">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Add milestone
        </h2>
        <AddAwardForm disabled={isPending} onAdd={createAward} />
      </section>
    </div>
  )
}

/** Props for one editable milestone row. */
interface AwardRowProps {
  award: OtfMileageAward
  disabled: boolean
  onSave: (id: string, body: { label: string; miles: number; color: string }) => Promise<void>
  onDelete: (award: OtfMileageAward) => Promise<void>
}

/** One existing milestone tier as an inline-editable label / miles / color form. */
function AwardRow({ award, disabled, onSave, onDelete }: AwardRowProps): JSX.Element {
  const [label, setLabel] = useState<string>(award.label)
  const [miles, setMiles] = useState<number>(award.miles)
  const [color, setColor] = useState<string>(award.color ?? DEFAULT_NEW_COLOR)
  const dirty = label !== award.label || miles !== award.miles || color !== (award.color ?? DEFAULT_NEW_COLOR)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmed = label.trim()
    if (!dirty || trimmed.length === 0 || !(miles > 0)) return
    await onSave(award.id, { label: trimmed, miles, color })
  }

  return (
    <li className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 sm:gap-4">
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">name</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-40 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">miles</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={miles}
            onChange={(e) => setMiles(Number(e.target.value))}
            className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-black/40"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="submit"
            disabled={disabled || !dirty}
            className="rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(award)}
            className="rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </form>
    </li>
  )
}

/** Props for the add-milestone form. */
interface AddAwardFormProps {
  disabled: boolean
  onAdd: (body: { label: string; miles: number; color: string }) => Promise<boolean>
}

/** Small form to append a new milestone tier; clears itself on a successful add. */
function AddAwardForm({ disabled, onAdd }: AddAwardFormProps): JSX.Element {
  const [label, setLabel] = useState<string>('')
  const [miles, setMiles] = useState<number>(13.1)
  const [color, setColor] = useState<string>(DEFAULT_NEW_COLOR)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmed = label.trim()
    if (trimmed.length === 0 || !(miles > 0)) return
    const ok = await onAdd({ label: trimmed, miles, color })
    if (!ok) return
    setLabel('')
    setMiles(13.1)
    setColor(DEFAULT_NEW_COLOR)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid gap-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
    >
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">name</span>
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Marathon"
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">miles</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={miles}
          onChange={(e) => setMiles(Number(e.target.value))}
          className="w-24 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-black/40"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || label.trim().length === 0}
        className="rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
