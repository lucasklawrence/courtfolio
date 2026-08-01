'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type FormEvent, type JSX } from 'react'

import {
  AMRAP_LABEL,
  formatSlotPrescription,
  isSuperset,
} from '@/lib/training-facility/template-format'
import type {
  TemplateCategory,
  TemplateSlot,
  WeightRoomExercise,
  WorkoutTemplate,
} from '@/types/weight-room'

/** Props for {@link TemplateBuilder}. */
export interface TemplateBuilderProps {
  /**
   * Templates as read by the server component, archived ones included, with
   * slots / steps / alternates attached. Mutations refresh via
   * `router.refresh()` so the next render comes from a fresh server fetch.
   */
  initialTemplates: readonly WorkoutTemplate[]
  /** The movement catalog, for the exercise pickers. Archived entries filtered by the caller. */
  exercises: readonly WeightRoomExercise[]
}

/** Selectable template categories, matching the DB check constraint. */
const CATEGORIES: readonly TemplateCategory[] = [
  'push',
  'pull',
  'legs',
  'upper',
  'lower',
  'full-body',
  'other',
]

const DEFAULT_TEMPLATE_COLOR = '#DC2626'

/**
 * Admin-only workout-template builder (#375).
 *
 * A template is a named, ordered prescription — the "plan" half of the gym
 * workouts arc. Slots are edited **in place** rather than replaced on save,
 * because #376 links each logged set to the slot it was performed for; a
 * save that recreated slots would orphan that history on every edit.
 *
 * Mobile-first like its Settings siblings: templates and slots both collapse to
 * a summary line and expand into their editor, so six templates of seven
 * movements each stay navigable on a phone.
 */
export function TemplateBuilder({
  initialTemplates,
  exercises,
}: TemplateBuilderProps): JSX.Element {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [isPending, startTransition] = useTransition()

  const visible = useMemo(
    () => initialTemplates.filter(t => showArchived || t.archived !== true),
    [initialTemplates, showArchived]
  )
  const archivedCount = useMemo(
    () => initialTemplates.filter(t => t.archived === true).length,
    [initialTemplates]
  )

  function refresh(): void {
    startTransition(() => router.refresh())
  }

  /** Issue a mutation, surface `{ error }` on failure, refresh on success. */
  async function mutate(url: string, init: RequestInit, fallback: string): Promise<boolean> {
    setError(null)
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? `${fallback} (${res.status})`)
      return false
    }
    refresh()
    return true
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}

      {archivedCount > 0 ? (
        <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="h-4 w-4 accent-amber-300"
          />
          Show archived ({archivedCount})
        </label>
      ) : null}

      <section aria-label="Workout templates" className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-[#e8d5be]/70">
            No templates yet — add one below, then add the movements it prescribes.
          </p>
        ) : (
          visible.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              exercises={exercises}
              disabled={isPending}
              onMutate={mutate}
            />
          ))
        )}
      </section>

      <section aria-label="Add a template">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Add template
        </h3>
        <AddTemplateForm
          disabled={isPending}
          existingNames={initialTemplates.map(t => t.name.toLowerCase())}
          nextPosition={initialTemplates.length}
          onMutate={mutate}
        />
      </section>
    </div>
  )
}

/** Shared mutation signature threaded down from {@link TemplateBuilder}. */
type Mutate = (url: string, init: RequestInit, fallback: string) => Promise<boolean>

interface TemplateCardProps {
  template: WorkoutTemplate
  exercises: readonly WeightRoomExercise[]
  disabled: boolean
  onMutate: Mutate
}

function TemplateCard({ template, exercises, disabled, onMutate }: TemplateCardProps): JSX.Element {
  const archived = template.archived === true
  const base = `/api/admin/weight-room/templates/${template.id}`

  async function move(slot: TemplateSlot, direction: -1 | 1): Promise<void> {
    const ordered = [...template.slots].sort((a, b) => a.position - b.position)
    const index = ordered.findIndex(s => s.id === slot.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return

    // Swap the two positions and send both in one request — the unique
    // constraint is deferrable precisely so this transient duplicate is legal.
    const a = ordered[index]
    const b = ordered[target]
    await onMutate(
      `${base}/slots`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          order: [
            { id: a.id, position: b.position },
            { id: b.id, position: a.position },
          ],
        }),
      },
      'Reorder failed'
    )
  }

  return (
    <div
      className={`rounded-[1.1rem] border border-white/10 bg-white/5 ${archived ? 'opacity-50' : ''}`}
    >
      <details>
        <summary className="cursor-pointer list-none px-4 py-3">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: template.color ?? '#666' }}
            />
            <span className="text-sm font-semibold text-white">{template.name}</span>
            {template.category ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                {template.category}
              </span>
            ) : null}
            <span className="ml-auto font-mono text-[11px] text-white/40">
              {template.slots.length} {template.slots.length === 1 ? 'movement' : 'movements'}
              {archived ? ' · archived' : ''}
            </span>
          </span>
        </summary>

        <div className="space-y-4 border-t border-white/10 p-4">
          <TemplateMetaForm template={template} disabled={disabled} onMutate={onMutate} />

          <div>
            <h4 className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300/70">
              Movements
            </h4>
            {template.slots.length === 0 ? (
              <p className="mt-2 text-sm text-white/50">
                No movements yet — add the first one below.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...template.slots]
                  .sort((a, b) => a.position - b.position)
                  .map((slot, index, all) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      exercises={exercises}
                      templateBase={base}
                      disabled={disabled}
                      isFirst={index === 0}
                      isLast={index === all.length - 1}
                      onMove={move}
                      onMutate={onMutate}
                    />
                  ))}
              </ul>
            )}
          </div>

          <AddSlotForm
            templateBase={base}
            exercises={exercises}
            disabled={disabled}
            onMutate={onMutate}
          />

          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onMutate(
                  base,
                  { method: 'PATCH', body: JSON.stringify({ archived: !archived }) },
                  'Save failed'
                )
              }
              className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const ok = window.confirm(
                  `Delete "${template.name}"? Its movements go with it. Sets you already logged against it are kept — they just stop being linked to a prescription. Archive instead if you may run it again.`
                )
                if (ok) void onMutate(base, { method: 'DELETE' }, 'Delete failed')
              }}
              className="ml-auto rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}

interface TemplateMetaFormProps {
  template: WorkoutTemplate
  disabled: boolean
  onMutate: Mutate
}

function TemplateMetaForm({ template, disabled, onMutate }: TemplateMetaFormProps): JSX.Element {
  const [name, setName] = useState(template.name)
  const [category, setCategory] = useState<TemplateCategory | ''>(template.category ?? '')
  const [color, setColor] = useState(template.color ?? DEFAULT_TEMPLATE_COLOR)
  const [description, setDescription] = useState(template.description ?? '')

  const dirty =
    name !== template.name ||
    category !== (template.category ?? '') ||
    color !== (template.color ?? DEFAULT_TEMPLATE_COLOR) ||
    description !== (template.description ?? '')

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!dirty) return
    await onMutate(
      `/api/admin/weight-room/templates/${template.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          color,
          description,
          category: category === '' ? null : category,
        }),
      },
      'Save failed'
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">name</span>
        <input
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={e => setName(e.target.value)}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">category</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as TemplateCategory | '')}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        >
          <option value="" className="bg-[#120d0a]">
            — none —
          </option>
          {CATEGORIES.map(c => (
            <option key={c} value={c} className="bg-[#120d0a]">
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70 sm:col-span-2">
        <span className="font-mono uppercase tracking-[0.18em]">description</span>
        <input
          type="text"
          maxLength={2000}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Target pace: 35 min"
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">color</span>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-black/40"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || !dirty}
          className="mb-0.5 rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </form>
  )
}

interface SlotRowProps {
  slot: TemplateSlot
  exercises: readonly WeightRoomExercise[]
  templateBase: string
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onMove: (slot: TemplateSlot, direction: -1 | 1) => Promise<void>
  onMutate: Mutate
}

function SlotRow({
  slot,
  exercises,
  templateBase,
  disabled,
  isFirst,
  isLast,
  onMove,
  onMutate,
}: SlotRowProps): JSX.Element {
  const label = exercises.find(e => e.slug === slot.exercise)?.display_name ?? slot.exercise
  const sequenceLabel = slot.steps.length === 0 ? null : isSuperset(slot) ? 'superset' : 'drop set'

  return (
    <li className="rounded-[0.9rem] border border-white/10 bg-black/20">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col">
          <button
            type="button"
            aria-label={`Move ${label} up`}
            disabled={disabled || isFirst}
            onClick={() => void onMove(slot, -1)}
            className="px-1 text-[10px] leading-none text-white/50 transition hover:text-white disabled:opacity-20"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`Move ${label} down`}
            disabled={disabled || isLast}
            onClick={() => void onMove(slot, 1)}
            className="px-1 text-[10px] leading-none text-white/50 transition hover:text-white disabled:opacity-20"
          >
            ▼
          </button>
        </div>
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer list-none">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm text-white">{label}</span>
              <span className="font-mono text-[11px] text-white/50">
                {formatSlotPrescription(slot)}
              </span>
              {sequenceLabel ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
                  {sequenceLabel}
                </span>
              ) : null}
              {slot.alternates.length > 0 ? (
                <span className="font-mono text-[10px] text-white/35">
                  {slot.alternates.length} alt
                </span>
              ) : null}
            </span>
          </summary>
          <SlotEditor
            slot={slot}
            exercises={exercises}
            templateBase={templateBase}
            disabled={disabled}
            onMutate={onMutate}
          />
        </details>
      </div>
    </li>
  )
}

interface SlotEditorProps {
  slot: TemplateSlot
  exercises: readonly WeightRoomExercise[]
  templateBase: string
  disabled: boolean
  onMutate: Mutate
}

/** A step row as edited locally; empty strings mean "not set". */
interface StepDraft {
  exercise: string
  target_reps: string
  target_weight_lbs: string
}

function SlotEditor({
  slot,
  exercises,
  templateBase,
  disabled,
  onMutate,
}: SlotEditorProps): JSX.Element {
  const [sets, setSets] = useState(String(slot.target_sets))
  const [setsMax, setSetsMax] = useState(slot.target_sets_max?.toString() ?? '')
  const [reps, setReps] = useState(slot.target_reps?.toString() ?? '')
  const [repsMax, setRepsMax] = useState(slot.target_reps_max?.toString() ?? '')
  const [weight, setWeight] = useState(slot.target_weight_lbs?.toString() ?? '')
  const [rest, setRest] = useState(slot.rest_seconds?.toString() ?? '')
  const [notes, setNotes] = useState(slot.notes ?? '')
  const [alternates, setAlternates] = useState<string[]>(slot.alternates.map(a => a.exercise))
  const [steps, setSteps] = useState<StepDraft[]>(
    slot.steps.map(s => ({
      exercise: s.exercise ?? '',
      target_reps: s.target_reps?.toString() ?? '',
      target_weight_lbs: s.target_weight_lbs?.toString() ?? '',
    }))
  )

  const slotUrl = `${templateBase}/slots/${slot.id}`

  /** Parse a numeric field; empty string becomes null (an explicit clear). */
  function num(value: string): number | null {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const setsValue = num(sets)
    if (setsValue === null || setsValue < 1) return

    await onMutate(
      slotUrl,
      {
        method: 'PATCH',
        body: JSON.stringify({
          target_sets: setsValue,
          target_sets_max: num(setsMax),
          target_reps: num(reps),
          target_reps_max: num(repsMax),
          target_weight_lbs: num(weight),
          rest_seconds: num(rest),
          notes,
          alternates,
          steps: steps
            .filter(s => s.exercise !== '' || s.target_reps !== '' || s.target_weight_lbs !== '')
            .map(s => ({
              ...(s.exercise !== '' ? { exercise: s.exercise } : {}),
              ...(num(s.target_reps) !== null ? { target_reps: num(s.target_reps) } : {}),
              ...(num(s.target_weight_lbs) !== null
                ? { target_weight_lbs: num(s.target_weight_lbs) }
                : {}),
            })),
        }),
      },
      'Save failed'
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-3 border-t border-white/10 pt-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="sets" value={sets} onChange={setSets} min={1} />
        <NumberField label="sets max" value={setsMax} onChange={setSetsMax} min={1} />
        <NumberField label="reps" value={reps} onChange={setReps} min={1} />
        <NumberField label="reps max" value={repsMax} onChange={setRepsMax} min={1} />
        <NumberField label="lb / implement" value={weight} onChange={setWeight} min={0} />
        <NumberField label="rest (s)" value={rest} onChange={setRest} min={0} />
      </div>
      <p className="text-[11px] leading-5 text-white/40">
        Leave reps blank for <strong>{AMRAP_LABEL}</strong>. Reps are totals, not per side. Weight
        is per implement — a pair of 35s is 35.
      </p>

      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">notes</span>
        <input
          type="text"
          maxLength={500}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Rack run — descending down the rack"
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
      </label>

      <fieldset className="rounded border border-white/10 p-3">
        <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
          within-set sequence
        </legend>
        <p className="mb-2 text-[11px] leading-5 text-white/40">
          Leave empty for an ordinary straight set. Same movement at descending loads is a{' '}
          <strong>drop set</strong>; naming a different movement makes it a{' '}
          <strong>superset</strong>.
        </p>
        {steps.map((step, index) => (
          <div key={index} className="mb-2 grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-white/60">
              <span className="font-mono uppercase tracking-[0.14em]">movement</span>
              <select
                value={step.exercise}
                onChange={e =>
                  setSteps(
                    steps.map((s, i) => (i === index ? { ...s, exercise: e.target.value } : s))
                  )
                }
                className="rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none"
              >
                <option value="" className="bg-[#120d0a]">
                  — same as slot —
                </option>
                {exercises.map(e => (
                  <option key={e.slug} value={e.slug} className="bg-[#120d0a]">
                    {e.display_name}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="reps"
              value={step.target_reps}
              onChange={v =>
                setSteps(steps.map((s, i) => (i === index ? { ...s, target_reps: v } : s)))
              }
              min={1}
              compact
            />
            <NumberField
              label="lb"
              value={step.target_weight_lbs}
              onChange={v =>
                setSteps(steps.map((s, i) => (i === index ? { ...s, target_weight_lbs: v } : s)))
              }
              min={0}
              compact
            />
            <button
              type="button"
              aria-label={`Remove step ${index + 1}`}
              onClick={() => setSteps(steps.filter((_, i) => i !== index))}
              className="mb-1 rounded border border-white/15 px-2 py-1 text-[11px] text-white/60 transition hover:border-rose-300/40 hover:text-rose-200"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSteps([...steps, { exercise: '', target_reps: '', target_weight_lbs: '' }])
          }
          className="rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10"
        >
          + step
        </button>
      </fieldset>

      <fieldset className="rounded border border-white/10 p-3">
        <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
          alternates
        </legend>
        <p className="mb-2 text-[11px] leading-5 text-white/40">
          Swaps offered first when the rack is taken, in order. Anything in the catalog stays
          reachable during a workout — this is only the shortcut.
        </p>
        {alternates.map((alt, index) => (
          <div key={index} className="mb-2 flex items-center gap-2">
            <select
              value={alt}
              onChange={e =>
                setAlternates(alternates.map((a, i) => (i === index ? e.target.value : a)))
              }
              className="min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none"
            >
              {exercises.map(e => (
                <option key={e.slug} value={e.slug} className="bg-[#120d0a]">
                  {e.display_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Remove alternate ${index + 1}`}
              onClick={() => setAlternates(alternates.filter((_, i) => i !== index))}
              className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/60 transition hover:border-rose-300/40 hover:text-rose-200"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={exercises.length === 0}
          onClick={() => setAlternates([...alternates, exercises[0]?.slug ?? ''])}
          className="rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          + alternate
        </button>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save movement
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const ok = window.confirm('Remove this movement from the template?')
            if (ok) void onMutate(slotUrl, { method: 'DELETE' }, 'Delete failed')
          }}
          className="ml-auto rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Remove
        </button>
      </div>
    </form>
  )
}

interface NumberFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  min: number
  compact?: boolean
}

function NumberField({ label, value, onChange, min, compact }: NumberFieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-white/60">
      <span className="font-mono uppercase tracking-[0.14em]">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`rounded border border-white/15 bg-black/40 px-2 py-1 text-right font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none ${compact ? 'w-16' : ''}`}
      />
    </label>
  )
}

interface AddSlotFormProps {
  templateBase: string
  exercises: readonly WeightRoomExercise[]
  disabled: boolean
  onMutate: Mutate
}

function AddSlotForm({
  templateBase,
  exercises,
  disabled,
  onMutate,
}: AddSlotFormProps): JSX.Element {
  const [exercise, setExercise] = useState(exercises[0]?.slug ?? '')
  const [sets, setSets] = useState('4')
  const [reps, setReps] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (exercise === '') return
    const setsValue = Number(sets)
    if (!Number.isFinite(setsValue) || setsValue < 1) return

    const created = await onMutate(
      `${templateBase}/slots`,
      {
        method: 'POST',
        body: JSON.stringify({
          exercise,
          target_sets: setsValue,
          ...(reps.trim() !== '' ? { target_reps: Number(reps) } : {}),
        }),
      },
      'Add failed'
    )
    if (created) setReps('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-2 rounded border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
    >
      <label className="flex flex-col gap-1 text-[11px] text-white/60">
        <span className="font-mono uppercase tracking-[0.14em]">add movement</span>
        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white focus:border-amber-300/60 focus:outline-none"
        >
          {exercises.map(e => (
            <option key={e.slug} value={e.slug} className="bg-[#120d0a]">
              {e.display_name}
            </option>
          ))}
        </select>
      </label>
      <NumberField label="sets" value={sets} onChange={setSets} min={1} compact />
      <NumberField label="reps" value={reps} onChange={setReps} min={1} compact />
      <button
        type="submit"
        disabled={disabled || exercise === ''}
        className="rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}

interface AddTemplateFormProps {
  disabled: boolean
  existingNames: readonly string[]
  nextPosition: number
  onMutate: Mutate
}

function AddTemplateForm({
  disabled,
  existingNames,
  nextPosition,
  onMutate,
}: AddTemplateFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory | ''>('')
  const [color, setColor] = useState(DEFAULT_TEMPLATE_COLOR)

  const taken = name.trim() !== '' && existingNames.includes(name.trim().toLowerCase())

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (name.trim() === '' || taken) return
    const created = await onMutate(
      '/api/admin/weight-room/templates',
      {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          color,
          position: nextPosition,
          ...(category !== '' ? { category } : {}),
        }),
      },
      'Add failed'
    )
    if (created) setName('')
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
          maxLength={80}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Chest Day 1"
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
        {taken ? (
          <span role="alert" className="font-mono text-[11px] text-rose-300">
            A template with that name already exists.
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">category</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as TemplateCategory | '')}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
        >
          <option value="" className="bg-[#120d0a]">
            — none —
          </option>
          {CATEGORIES.map(c => (
            <option key={c} value={c} className="bg-[#120d0a]">
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">color</span>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-black/40"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || name.trim() === '' || taken}
        className="rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
