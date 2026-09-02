import type { JSX, ReactNode } from 'react'

import { formatDayKey } from '@/lib/training-facility/day-keys'
import type { EraComparison, TrainingEra } from '@/lib/training-facility/era-comparison'
import { describeSetOrHold, formatLbs } from '@/lib/training-facility/strength-format'

/** Date style for an era's endpoints — month and year is the right altitude for a multi-year span. */
const ERA_DATE: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }

/** Props for {@link ThenVsNowPanel}. */
export interface ThenVsNowPanelProps {
  /** The two eras and what changed between them. */
  comparison: EraComparison
  /** Human-readable movement name, resolved by the caller with `slugLabel` (#384). */
  displayName: string
  /**
   * Whether the earlier era was transcribed from the Apple Notes archive,
   * as answered by `eraIsImported`.
   *
   * Required rather than assumed: this panel renders for *any* long gap, and a
   * movement can simply have been left alone for a year. Claiming an import
   * that never happened would put a false provenance on real training.
   */
  earlierEraImported: boolean
  /**
   * Whether the *later* era is also imported.
   *
   * A movement trained only during the archive still has eras — the archive
   * contains its own layoffs, and a movement like dumbbell curl splits at a
   * 254-day one. Both sides are then imported, and saying "the earlier one
   * comes from Apple Notes" would imply the later one doesn't.
   */
  currentEraImported: boolean
  /**
   * Whether the later era is what the log is currently doing, as answered by
   * `isCurrentEra`.
   *
   * False for most movements here: barbell, machine and sled work stopped in
   * 2024, so their later era is two years old. Splitting the archive against
   * itself is still worth showing, but calling the later half "Now" — and
   * saying "current training has passed" about it — would be a claim about the
   * present that the log contradicts.
   */
  laterEraIsCurrent: boolean
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
export function ThenVsNowPanel({
  comparison,
  displayName,
  earlierEraImported,
  currentEraImported,
  laterEraIsCurrent,
}: ThenVsNowPanelProps): JSX.Element {
  const { then, now, gapDays } = comparison
  const gapYears = gapDays / 365
  const movement = displayName.toLowerCase()

  const provenance =
    earlierEraImported && currentEraImported
      ? 'Both come from training logged in Apple Notes and imported into this log.'
      : earlierEraImported
        ? 'The earlier one comes from training logged in Apple Notes and imported into this log.'
        : 'The earlier one is training this log already carried.'

  return (
    <section
      data-testid="then-vs-now"
      className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6"
      aria-label={`${displayName}: ${laterEraIsCurrent ? 'then versus now' : 'two stretches compared'}`}
    >
      <header>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
          {laterEraIsCurrent ? 'Then vs now' : 'Two stretches'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#e8d5be]/75">
          {gapYears >= 1
            ? `${gapYears.toFixed(1)} years separate these two stretches of ${movement}.`
            : `${gapDays} days separate these two stretches of ${movement}.`}{' '}
          {provenance}
          {laterEraIsCurrent ? null : (
            <>
              {' '}
              Last trained{' '}
              <strong className="font-black text-[#fff7ec]">
                {formatDayKey(now.endDayKey, ERA_DATE)}
              </strong>
              .
            </>
          )}
        </p>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EraColumn era={then} label={laterEraIsCurrent ? 'Then' : 'Earlier'} />
        <EraColumn
          era={now}
          label={laterEraIsCurrent ? 'Now' : 'Later'}
          isCurrent={laterEraIsCurrent}
        />
      </div>

      <Verdict
        comparison={comparison}
        displayName={displayName}
        laterEraIsCurrent={laterEraIsCurrent}
      />
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
          value={era.heaviestSet === null ? null : describeSetOrHold(era.heaviestSet)}
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
  /** Whether the later era is the present — see {@link ThenVsNowPanelProps}. */
  laterEraIsCurrent: boolean
}

/** The verdict's shared shell, so every branch gets the same box and test id. */
function Sentence({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p
      data-testid="then-vs-now-verdict"
      className="mt-4 rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[#e8d5be]/80"
    >
      {children}
    </p>
  )
}

/**
 * One line saying whether the current era has passed the old one.
 *
 * Four branches, because three of them would otherwise print something false:
 * a movement bodyweight in *both* eras has no load to compare and gets reps
 * instead; one loaded on a single side is not comparable by weight at all, and
 * saying "neither stretch was loaded" is contradicted by the adjacent column;
 * and a dead heat is neither "passed" nor "still above", both of which would
 * render as "by 0 lb".
 */
function Verdict({ comparison, displayName, laterEraIsCurrent }: VerdictProps): JSX.Element | null {
  const { heaviestDelta, surpassedHeaviest, then, now } = comparison
  const movement = displayName.toLowerCase()
  const repsDelta = now.reps - then.reps

  // Every branch below ends its sentence on the bold value, with a `{' '}`
  // ahead of it. Not a style preference: JSX drops the space between a closing
  // tag and following text when that text wraps to the next source line, and
  // prettier rewrites an explicit `{' '}` back into exactly that shape — so
  // "passed the" reflows into "passedthe" on the next format run. Keeping the
  // emphasis last means nothing ever follows it to lose a space against.
  const reps = `${Math.abs(repsDelta).toLocaleString('en-US')} ${repsDelta > 0 ? 'more' : 'fewer'} reps`

  if (surpassedHeaviest === null || heaviestDelta === null) {
    const bothBodyweight = then.heaviestSet === null && now.heaviestSet === null

    if (!bothBodyweight) {
      const loadedSide =
        now.heaviestSet !== null
          ? laterEraIsCurrent
            ? 'the current stretch'
            : 'the later stretch'
          : 'the earlier stretch'
      if (repsDelta === 0) {
        return (
          <Sentence>
            Only {loadedSide} carried external load, so the two aren&rsquo;t comparable by weight —
            and both carry the same {movement} rep volume.
          </Sentence>
        )
      }
      return (
        <Sentence>
          Only {loadedSide} carried external load, so the two aren&rsquo;t comparable by weight. In{' '}
          {movement} reps, this stretch carries{' '}
          <strong className="font-black text-[#fff7ec]">{reps}</strong>.
        </Sentence>
      )
    }

    if (repsDelta === 0) return null
    return (
      <Sentence>
        Neither stretch was loaded, so the comparison is in reps: this stretch carries{' '}
        <strong className="font-black text-[#fff7ec]">{reps}</strong> of {movement}.
      </Sentence>
    )
  }

  if (heaviestDelta === 0) {
    return (
      <Sentence>
        Both stretches top out at the same {movement} —{' '}
        <strong className="font-black text-[#fff7ec]">
          {formatLbs(now.heaviestSet?.effectiveLoad ?? 0)}
        </strong>
        .
      </Sentence>
    )
  }

  const magnitude = formatLbs(Math.abs(heaviestDelta))

  // "Current training" is only true when the later era *is* current. For a
  // movement last trained in 2024 the same sentence describes two archive
  // stretches as if one were the present.
  const later = laterEraIsCurrent ? 'Current training' : 'The later stretch'
  const earlierLeads = laterEraIsCurrent ? 'the current one' : 'the later one'

  return (
    <Sentence>
      {surpassedHeaviest ? (
        <>
          {later} has passed the earlier stretch&rsquo;s heaviest {movement} by{' '}
          <strong className="font-black text-[#fff7ec]">{magnitude}</strong>.
        </>
      ) : (
        <>
          The earlier stretch&rsquo;s heaviest {movement} still leads {earlierLeads} by{' '}
          <strong className="font-black text-[#fff7ec]">{magnitude}</strong>.
        </>
      )}
    </Sentence>
  )
}
