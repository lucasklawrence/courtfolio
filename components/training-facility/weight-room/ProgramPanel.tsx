import type { JSX } from 'react'

import { formatDayKey } from '@/lib/training-facility/day-keys'
import type { ProgramSummary, TemplateSummary } from '@/lib/training-facility/training-program'

/** Date style for the programme's endpoints. */
const SPAN_DATE: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }

/** Props for {@link ProgramPanel}. */
export interface ProgramPanelProps {
  /** The programme as the templated sessions record it. */
  summary: ProgramSummary
}

/**
 * The training programme behind the archive (#436).
 *
 * Answers a question no other Weight Room surface does: not "how did that
 * session go" or "is the bench going up", but *what the plan was and how well
 * it held*. Six templates, cycled, across sixteen months.
 *
 * A Server Component — no state, no effects.
 */
export function ProgramPanel({ summary }: ProgramPanelProps): JSX.Element {
  const { templates, rotation, adherence, months, totalSessions, firstDayKey, lastDayKey } = summary
  const span =
    firstDayKey === null || lastDayKey === null
      ? null
      : `${formatDayKey(firstDayKey, SPAN_DATE)} – ${formatDayKey(lastDayKey, SPAN_DATE)}`

  return (
    <div className="flex flex-col gap-8" data-testid="program-panel">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Programme at a glance">
        <Stat label="Sessions" value={totalSessions.toLocaleString('en-US')} detail={span} />
        <Stat label="Templates" value={String(templates.length)} detail="on rotation" />
        {adherence.total === 0 ? null : (
          <Stat
            label="Cycle held"
            value={`${Math.round(adherence.rate * 100)}%`}
            detail={`${adherence.followed} of ${adherence.total} in order`}
            title="How often the next session was the next template in the rotation"
          />
        )}
        <Stat label="Median session" value={medianOfMedians(templates)} detail="across templates" />
      </dl>

      {rotation.length === 0 ? null : <RotationStrip rotation={rotation} />}

      <TemplateTable templates={templates} />

      <CadenceChart months={months} />
    </div>
  )
}

/** Props for one headline figure. */
interface StatProps {
  /** What the number is. */
  label: string
  /** The number itself. */
  value: string
  /** Optional smaller line beneath. */
  detail?: string | null
  /** Optional hover explanation. */
  title?: string
}

/** One headline figure. */
function Stat({ label, value, detail, title }: StatProps): JSX.Element {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3" title={title}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">
        {label}
      </dt>
      <dd className="mt-1.5 text-lg font-black tabular-nums text-[#fff7ec]">{value}</dd>
      {detail ? (
        <dd className="mt-0.5 font-mono text-[10px] tracking-[0.12em] text-[#e8d5be]/50">
          {detail}
        </dd>
      ) : null}
    </div>
  )
}

/** The cycle, rendered in the order it was run. */
function RotationStrip({ rotation }: { rotation: readonly string[] }): JSX.Element {
  return (
    <section
      data-testid="program-rotation"
      className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5"
      aria-label="Rotation order"
    >
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        The rotation
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#e8d5be]/75">
        Read from the sessions themselves rather than from a configured order — this is what the log
        says was run, in the order it was run.
      </p>
      <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        {rotation.map((name, index) => (
          <li key={name} className="flex items-center gap-2">
            <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-3 py-1 text-xs font-semibold text-[#fff7ec]">
              {name}
            </span>
            <span aria-hidden="true" className="text-[#e8d5be]/35">
              {index === rotation.length - 1 ? '↺' : '→'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Per-template records. */
function TemplateTable({ templates }: { templates: readonly TemplateSummary[] }): JSX.Element {
  return (
    <section
      data-testid="program-templates"
      className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#f7ead9]"
    >
      <h2 className="px-5 pt-4 font-mono text-[11px] uppercase tracking-[0.28em] text-[#0a0a0a]/60">
        By template
      </h2>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-[34rem] border-collapse text-sm text-[#0a0a0a]">
          <thead>
            <tr className="border-b border-[#0a0a0a]/10 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
              <th scope="col" className="px-5 py-2 text-left font-normal">
                Template
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Sessions
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Median
              </th>
              <th scope="col" className="px-5 py-2 text-right font-normal">
                Span
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.map(template => (
              <tr key={template.id} className="border-b border-[#0a0a0a]/5 last:border-0">
                <th scope="row" className="px-5 py-2.5 text-left font-semibold">
                  {template.name}
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums">{template.sessions}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {template.medianMinutes === null ? (
                    <span className="text-[#0a0a0a]/35">—</span>
                  ) : (
                    `${Math.round(template.medianMinutes)} min`
                  )}
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-[11px] text-[#0a0a0a]/60">
                  {formatDayKey(template.firstDayKey, SPAN_DATE)} –{' '}
                  {formatDayKey(template.lastDayKey, SPAN_DATE)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * Sessions per month, as a bar per month.
 *
 * Deliberately includes months with none — a gap in training is the most
 * informative thing this chart has to show, and skipping empty months would
 * draw a continuous run straight over a layoff.
 */
function CadenceChart({ months }: { months: ProgramSummary['months'] }): JSX.Element {
  const peak = months.reduce((max, month) => Math.max(max, month.sessions), 0)

  return (
    <section
      data-testid="program-cadence"
      className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5"
      aria-label="Sessions per month"
    >
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        Cadence
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#e8d5be]/75">
        Templated sessions per month. Months with none are shown as gaps rather than skipped.
      </p>
      <ol className="mt-5 flex items-end gap-1.5" style={{ height: '7rem' }}>
        {months.map(month => (
          <li
            key={month.monthKey}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${month.monthKey}: ${month.sessions} session${month.sessions === 1 ? '' : 's'}`}
          >
            <div
              className={
                month.sessions === 0
                  ? 'w-full rounded-t-[3px] bg-white/[0.06]'
                  : 'w-full rounded-t-[3px] bg-amber-300/60'
              }
              // A zero month still draws a hairline, so the gap reads as a
              // measured zero rather than as missing data.
              style={{
                height:
                  month.sessions === 0 || peak === 0 ? '2px' : `${(month.sessions / peak) * 100}%`,
              }}
            />
          </li>
        ))}
      </ol>
      <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.12em] text-[#e8d5be]/45">
        <span>{months[0]?.monthKey}</span>
        <span>peak {peak}/mo</span>
        <span>{months[months.length - 1]?.monthKey}</span>
      </div>
    </section>
  )
}

/**
 * The median of the per-template medians, as a one-line "how long a session takes".
 *
 * @returns A formatted figure, or an em-dash when nothing was ever timed.
 */
function medianOfMedians(templates: readonly TemplateSummary[]): string {
  const values = templates
    .map(template => template.medianMinutes)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)
  if (values.length === 0) return '—'
  const mid = Math.floor(values.length / 2)
  const value = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
  return `${Math.round(value)} min`
}
