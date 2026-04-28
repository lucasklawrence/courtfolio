'use client'

import { useEffect, useId, useState, type JSX } from 'react'
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form'
import { ZodError } from 'zod'

import { logBenchmark } from '@/lib/data/movement'
import { BenchmarkSchema } from '@/lib/schemas/movement'
import type { Benchmark } from '@/types/movement'

/**
 * Raw form values. Number inputs produce strings (the DOM's `value` is
 * always a string, even when `type="number"`); the Zod resolver below
 * coerces them and rejects empty strings as "no value" rather than `0`
 * or `NaN`. Stored separately from {@link Benchmark} so the form layer
 * can reset to empty without violating the validated type.
 */
interface BenchmarkFormValues {
  date: string
  bodyweight_lbs: string
  shuttle_5_10_5_s: string
  vertical_in: string
  sprint_10y_s: string
  notes: string
}

const NUMERIC_FIELDS = [
  'bodyweight_lbs',
  'shuttle_5_10_5_s',
  'vertical_in',
  'sprint_10y_s',
] as const satisfies ReadonlyArray<keyof BenchmarkFormValues>

/**
 * Today as `YYYY-MM-DD` in the *caller's* local timezone. Exported so
 * the form's mount-effect can populate the date field client-side
 * (server-side render in a different timezone would otherwise pre-fill
 * the wrong day — e.g. UTC server + US-Pacific browser late at night).
 */
export function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear().toString().padStart(4, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function emptyValues(): BenchmarkFormValues {
  return {
    // Date intentionally starts empty so SSR and client hydration
    // agree on the initial DOM (no timezone-dependent value at render
    // time). The form's mount-effect sets it to `todayIso()` after
    // hydration so the user sees today's local date.
    date: '',
    bodyweight_lbs: '',
    shuttle_5_10_5_s: '',
    vertical_in: '',
    sprint_10y_s: '',
    notes: '',
  }
}

/**
 * Convert raw string inputs into a candidate {@link Benchmark}: empty
 * strings become "field omitted" (per PRD §7.6 partial-entry rules),
 * numeric strings parse to numbers. Returns the unvalidated candidate;
 * the caller passes it to {@link BenchmarkSchema} for the actual check.
 */
export function normalizeFormValues(values: BenchmarkFormValues): Record<string, unknown> {
  const out: Record<string, unknown> = { date: values.date.trim() }
  for (const key of NUMERIC_FIELDS) {
    const raw = values[key].trim()
    if (raw === '') continue
    // Number('') is 0 — handled above. Number('abc') is NaN; pass it
    // through so Zod's `.number()` rejects it with a useful path.
    out[key] = Number(raw)
  }
  const notes = values.notes.trim()
  if (notes !== '') out.notes = notes
  return out
}

/**
 * Tiny RHF resolver that runs {@link BenchmarkSchema} (after
 * normalization) and translates Zod issues into RHF's per-field error
 * shape. Avoids a `@hookform/resolvers` dependency for a single use
 * site — Zod's flattened-issues API is straightforward to map.
 */
const benchmarkResolver: Resolver<BenchmarkFormValues> = async (values) => {
  const candidate = normalizeFormValues(values)
  const result = BenchmarkSchema.safeParse(candidate)
  if (result.success) {
    // RHF inspects `values` for the submit handler when `errors` is
    // empty. We hand back the *raw* form values (typed) so the submit
    // handler can re-normalize and call the data layer.
    return { values, errors: {} }
  }
  return { values: {}, errors: zodErrorsToRhf(result.error) }
}

function zodErrorsToRhf(error: ZodError): Record<string, { type: string; message: string }> {
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of error.issues) {
    const path = issue.path[0]
    if (typeof path !== 'string') continue
    if (!(path in errors)) {
      errors[path] = { type: 'zod', message: issue.message }
    }
  }
  return errors
}

/** Props for {@link CombineEntryForm}. */
export interface CombineEntryFormProps {
  /**
   * Called after a successful POST so the parent can refetch the entry
   * list and update derived views (Scoreboard, Trading Card, etc.). The
   * full submitted entry is supplied for callers that want to merge
   * optimistically.
   */
  onSaved: (entry: Benchmark) => void | Promise<void>
}

const PANEL_BUTTON_LABEL_OPEN = 'Hide log panel'
const PANEL_BUTTON_LABEL_CLOSED = 'Log a session'

/**
 * Collapsible "Log a session" panel for the Combine page (PRD §7.5
 * view 7, §7.10 single-source-of-truth schema). Renders an
 * RHF + Zod-validated entry form that POSTs to the dev-only write
 * route via `logBenchmark()`.
 *
 * Hidden in non-dev builds — the parent `CombineDataIsland` is the
 * only caller and it already gates rendering, but the gate inside this
 * component is a defensive belt-and-suspenders so the panel can never
 * accidentally surface in production even if a future caller forgets.
 */
export function CombineEntryForm({ onSaved }: CombineEntryFormProps): JSX.Element | null {
  if (process.env.NODE_ENV !== 'development') return null
  return <CombineEntryFormImpl onSaved={onSaved} />
}

function CombineEntryFormImpl({ onSaved }: CombineEntryFormProps): JSX.Element {
  const headingId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedDate, setSavedDate] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BenchmarkFormValues>({
    defaultValues: emptyValues(),
    resolver: benchmarkResolver,
  })

  // Populate the date field with the user's local "today" after
  // mount. Doing this in an effect (not as the form default) keeps
  // SSR and client hydration in agreement — the initial render emits
  // an empty input on both sides, then the client patches it once
  // hydrated using the browser's timezone.
  useEffect(() => {
    setValue('date', todayIso())
  }, [setValue])

  const onSubmit: SubmitHandler<BenchmarkFormValues> = async (values) => {
    setServerError(null)
    setSavedDate(null)
    const candidate = normalizeFormValues(values)
    // Resolver already validated; this parse is a type-narrowing pass
    // so `entry` is typed as `Benchmark` for `logBenchmark()`.
    const parsed = BenchmarkSchema.safeParse(candidate)
    if (!parsed.success) {
      setServerError('Validation failed unexpectedly. Reload the page and try again.')
      return
    }
    const entry: Benchmark = parsed.data as Benchmark
    try {
      await logBenchmark(entry)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Save failed.')
      return
    }
    setSavedDate(entry.date)
    // Reset clears every field — including the date — so re-seed it
    // with the freshly-computed local today so the next entry doesn't
    // require the user to retype the date.
    reset({ ...emptyValues(), date: todayIso() })
    await onSaved(entry)
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-amber-300/30 bg-black/40 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80"
        >
          Dev · Log a session
        </h2>
        <button
          type="button"
          onClick={() => {
            setServerError(null)
            setSavedDate(null)
            setIsOpen((v) => !v)
          }}
          aria-expanded={isOpen}
          className="rounded border border-amber-300/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {isOpen ? PANEL_BUTTON_LABEL_OPEN : PANEL_BUTTON_LABEL_CLOSED}
        </button>
      </header>

      {isOpen && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field
            label="Date"
            name="date"
            type="date"
            required
            error={errors.date?.message}
            register={register}
          />
          <Field
            label="Bodyweight (lbs)"
            name="bodyweight_lbs"
            type="number"
            step="0.1"
            min="0"
            placeholder="232.4"
            error={errors.bodyweight_lbs?.message}
            register={register}
          />
          <Field
            label="5-10-5 Shuttle (s)"
            name="shuttle_5_10_5_s"
            type="number"
            step="0.01"
            min="0"
            placeholder="5.12"
            error={errors.shuttle_5_10_5_s?.message}
            register={register}
          />
          <Field
            label="Vertical jump (in)"
            name="vertical_in"
            type="number"
            step="0.1"
            min="0"
            placeholder="22.5"
            error={errors.vertical_in?.message}
            register={register}
          />
          <Field
            label="10-yard sprint (s)"
            name="sprint_10y_s"
            type="number"
            step="0.01"
            min="0"
            placeholder="1.85"
            error={errors.sprint_10y_s?.message}
            register={register}
          />
          <div className="sm:col-span-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
                Notes
              </span>
              <textarea
                rows={3}
                placeholder="Felt sluggish on the second 5-10-5."
                className="mt-1.5 block w-full resize-y rounded border border-amber-300/30 bg-neutral-950/60 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-200/30 focus:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                {...register('notes')}
              />
              {errors.notes?.message && (
                <p className="mt-1 font-mono text-[11px] text-rose-400">{errors.notes.message}</p>
              )}
            </label>
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-h-[1.25rem] font-mono text-[11px] tracking-wide" role="status">
              {serverError && (
                <span className="text-rose-400">{serverError}</span>
              )}
              {savedDate && !serverError && (
                <span className="text-emerald-400">Saved entry for {savedDate}.</span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-amber-300 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-950 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

interface FieldProps {
  label: string
  name: keyof BenchmarkFormValues
  type: 'date' | 'number'
  required?: boolean
  step?: string
  min?: string
  placeholder?: string
  error?: string
  register: ReturnType<typeof useForm<BenchmarkFormValues>>['register']
}

/**
 * Single labeled input row. Uses native `<input>` (no shadcn dependency
 * — see PR description). The label wraps the input so clicking the
 * label focuses it and screen readers associate them automatically.
 */
function Field({
  label,
  name,
  type,
  required,
  step,
  min,
  placeholder,
  error,
  register,
}: FieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        type={type}
        step={step}
        min={min}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className="mt-1.5 block w-full rounded border border-amber-300/30 bg-neutral-950/60 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-200/30 focus:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        // No per-field rules — the Zod resolver is the single source
        // of truth for validation. The `required` prop here only
        // controls the visual "*" marker on the label.
        {...register(name)}
      />
      {error && <p className="mt-1 font-mono text-[11px] text-rose-400">{error}</p>}
    </label>
  )
}

