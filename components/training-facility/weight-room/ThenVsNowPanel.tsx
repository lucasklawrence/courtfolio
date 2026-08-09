import type { JSX } from 'react'

import { formatDayKey } from '@/lib/training-facility/day-keys'
import type { EraComparison, TrainingEra } from '@/lib/training-facility/era-comparison'
import { describeSet, formatLbs } from '@/lib/training-facility/strength-format'

/** Date style for an era's endpoints — month and year is the right altitude for a multi-year span. */
const ERA_DATE: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }

/** Props for {@link ThenVsNowPanel}. */
export interface ThenVsNowPanelProps {
  /** The two eras and what changed between them. */
  comparison: EraComparison
  /** Human-readable movement name, resolved by the caller with `slugLabel` (#384). */
  displayName: string
}

/**
 * Then-vs-now for one movement (#400 phase 2).
 *
 * The reason the iCloud Notes archive was imported at all. A progression chart
 * draws both eras and lets the eye compare across a two-year silence that
 * compresses to a few pixels; this states the comparison instead — same
 * movement, two stretches of training, side by side.
 *
 * Both columns render the same rows in the same order so the two are readable
 * as a pair, and a measure absent from either era renders as an em-dash rather
 * than a zero: an era of bodyweight work has no heaviest set, and printing
 * `0 lb` would assert something false about the training.
 *
 * A Server Component — no state, no effects.
 */
export function ThenVsNowPanel({ comparison, displayName }: ThenVsNowPanelProps): JSX.Element {
  const { then, now, gapDays } = comparison
  const gapYears = gapDays / 365

  return (
    <section
      data-testid="then-vs-now"
      className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6"
      aria-label={`${displayName}: then versus now`}
    >
      <header>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
          Then vs now
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#e8d5be]/75">
          {gapYears >= 1
            ? `${gapYears.toFixed(1)} years separate these two stretches of ${displayName.toLowerCase()}.`
            : `${gapDays} days separate these two stretches of ${displayName.toLowerCase()}.`}{' '}
          The earlier one comes from training logged in Apple Notes and imported into this log.
        </p>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EraColumn era={then} label="Then" />
        <EraColumn era={now} label="Now" isCurrent />
      </div>

      <Verdict comparison={comparison} displayName={displayName} />
    </section>
  )
}

/** Props for one era's column. */
interface EraColumnProps {
  /** The era to render. */
  era: TrainingEra
  /** Column heading — "Then" or "Now". */
  label: string
  /** Whether this is the current era, which gets the accent treatment. */
  isCurrent?: boolean
}

/** One era's marks, as a definition list so the pairs stay associated for a screen reader. */
function EraColumn({ era, label, isCurrent = false }: EraColumnProps): JSX.Element {
  const span = `${formatDayKey(era.startDayKey, ERA_DATE)} – ${formatDayKey(era.endDayKey, ERA_DATE)}`

  return (
    <div
      data-testid={`era-${label.toLowerCase()}`}
      className={`rounded-[1.1rem] border px-4 py-4 ${
        isCurrent ? 'border-amber-300/30 bg-amber-300/[0.06]' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[#fff7ec]">{span}</p>
      <p className="mt-0.5 font-mono text-[10px] tracking-[0.12em] text-[#e8d5be]/50">
        {era.trainingDays.toLocaleString('en-US')} training days ·{' '}
        {era.sets.toLocaleString('en-US')} sets
      </p>

      <dl className="mt-4 flex flex-col gap-2.5">
        <Measure
          label="Heaviest set"
          value={
            era.heaviestSet === null
              ? null
              : describeSet(era.heaviestSet.reps, era.heaviestSet.effectiveLoad)
          }
        />
        <Measure
          label="Typical top set"
          value={era.typicalTopSet === null ? null : formatLbs(era.typicalTopSet)}
          title="Median of each training day's heaviest set — what the working weight actually was"
        />
        <Measure
          label="Best est. 1RM"
          value={era.bestOneRepMax === null ? null : `~${formatLbs(era.bestOneRepMax)}`}
        />
        <Measure label="Reps" value={era.reps.toLocaleString('en-US')} />
        <Measure
          label="Volume"
          value={era.tonnage > 0 ? formatLbs(era.tonnage) : null}
          title="Σ reps × load across the era"
        />
      </dl>
    </div>
  )
}

/** Props for one labelled measure. */
interface MeasureProps {
  /** What the number is. */
  label: string
  /** The formatted number, or `null` when the era has no such measure. */
  value: string | null
  /** Optional hover explanation. */
  title?: string
}

/**
 * One measure within an era.
 *
 * An absent value renders as an em-dash, not a zero — a bodyweight era has no
 * heaviest set, and `0 lb` would read as a load that was lifted.
 */
function Measure({ label, value, title }: MeasureProps): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e8d5be]/55">
        {label}
      </dt>
      <dd className="text-sm font-black tabular-nums text-[#fff7ec]">
        {value ?? <span className="text-[#e8d5be]/35">—</span>}
      </dd>
    </div>
  )
}

/** Props for {@link Verdict}. */
interface VerdictProps {
  /** The comparison to summarize. */
  comparison: EraComparison
  /** Movement name, for the sentence. */
  displayName: string
}

/**
 * One line saying whether the current era has passed the old one.
 *
 * Only rendered when there is a like-for-like comparison to make. A movement
 * that was bodyweight in either era gets a rep-volume sentence instead, because
 * "not yet surpassed" would be a verdict on training that was never measured in
 * pounds.
 */
function Verdict({ comparison, displayName }: VerdictProps): JSX.Element | null {
  const { heaviestDelta, surpassedHeaviest, then, now } = comparison

  if (surpassedHeaviest === null || heaviestDelta === null) {
    // Bodyweight on at least one side — compare the thing that does exist.
    const repsDelta = now.reps - then.reps
    if (repsDelta === 0) return null
    return (
      <p
        data-testid="then-vs-now-verdict"
        className="mt-4 rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[#e8d5be]/80"
      >
        This stretch carries{' '}
        <strong className="font-black text-[#fff7ec]">
          {Math.abs(repsDelta).toLocaleString('en-US')} {repsDelta > 0 ? 'more' : 'fewer'} reps
        </strong>{' '}
        of {displayName.toLowerCase()} than the archive — measured in reps, since neither stretch
        was loaded.
      </p>
    )
  }

  const magnitude = formatLbs(Math.abs(heaviestDelta))

  return (
    <p
      data-testid="then-vs-now-verdict"
      className="mt-4 rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[#e8d5be]/80"
    >
      {surpassedHeaviest ? (
        <>
          Current training has <strong className="font-black text-[#fff7ec]">passed</strong> the
          archive&rsquo;s heaviest {displayName.toLowerCase()} by{' '}
          <strong className="font-black text-[#fff7ec]">{magnitude}</strong>.
        </>
      ) : (
        <>
          The archive&rsquo;s heaviest {displayName.toLowerCase()} is still{' '}
          <strong className="font-black text-[#fff7ec]">{magnitude}</strong> above anything in the
          current stretch.
        </>
      )}
    </p>
  )
}
