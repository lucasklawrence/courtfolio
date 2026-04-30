'use client'

import { useMemo, type JSX } from 'react'
import type { CardioSession } from '@/types/cardio'
import {
  MIN_PREVIOUS_SESSIONS_FOR_DELTA,
  computeDelta,
  type DeltaDirection,
  type PeriodDelta,
} from '@/lib/training-facility/period-comparison'

/**
 * Direction semantics for a stat card's delta. Drives the color of the
 * delta arrow:
 *
 * - `higher-is-better` — `up` is green, `down` is red
 * - `lower-is-better` — `up` is red, `down` is green
 * - `neutral` — both directions render in muted gray (the metric has
 *   no inherent improvement direction; e.g. average HR is good or bad
 *   only relative to the zone the user was targeting)
 */
export type CardioStatCardDirection = 'higher-is-better' | 'lower-is-better' | 'neutral'

/**
 * Definition of a single stat card. The card row is parameterized so
 * the Stair, Treadmill, and Track detail views can each supply their
 * own metric set without forking the component.
 */
export interface CardioStatCard {
  /** Stable React key and `data-testid` suffix. */
  key: string
  /** Card title (e.g. `"Avg HR"`, `"Total time"`). */
  label: string
  /**
   * Project a session list to a single scalar value, or `null` when the
   * metric isn't computable for the period (e.g. avg-HR with no
   * sessions carrying `avg_hr`). Pure function — receives the already-
   * filtered session list for the relevant period.
   */
  compute: (sessions: readonly CardioSession[]) => number | null
  /** Format the scalar value for the card body (e.g. `"32m 05s"`, `"148"`). */
  formatValue: (value: number) => string
  /**
   * Format the absolute delta for the delta line (e.g. `"+2m 15s"`,
   * `"−4"`). Should include the sign. Defaults to a signed call to
   * {@link CardioStatCard.formatValue}.
   */
  formatDelta?: (delta: number) => string
  /** Optional small unit string rendered next to the value (e.g. `"BPM"`). */
  unit?: string
  /** Direction semantics — drives the color of the delta arrow. */
  direction: CardioStatCardDirection
}

/** Props for {@link CardioStatsCards}. */
export interface CardioStatsCardsProps {
  /** Sessions filtered to the current period. */
  current: readonly CardioSession[]
  /** Sessions filtered to the previous (equal-length) period. */
  previous: readonly CardioSession[]
  /** Metric definitions, in display order. */
  metrics: ReadonlyArray<CardioStatCard>
  /** Tailwind classes appended to the outer grid wrapper. */
  className?: string
}

/**
 * `CardioStatsCards` — period-comparison stat row for Gym detail views (#77).
 *
 * Renders one card per metric in `metrics`, each showing the current
 * value and a delta line against the previous period. The card is
 * data-shape-driven via {@link CardioStatCard.compute}, so a Stair view
 * can supply different metrics from a Track view without a fork.
 *
 * Deltas are suppressed when the previous period contains fewer than
 * {@link MIN_PREVIOUS_SESSIONS_FOR_DELTA} sessions — a small-sample
 * comparison would advertise a misleading 100 %-style swing. The card
 * still renders the current value in that case; only the delta line
 * collapses to a "No prior comparison" placeholder.
 */
export function CardioStatsCards({
  current,
  previous,
  metrics,
  className = '',
}: CardioStatsCardsProps): JSX.Element {
  const cells = useMemo(() => {
    return metrics.map((metric) => {
      const currentValue = metric.compute(current)
      const previousValue = metric.compute(previous)
      const delta = computeDelta(currentValue, previousValue)
      const showDelta =
        previous.length >= MIN_PREVIOUS_SESSIONS_FOR_DELTA && delta !== null
      return { metric, currentValue, delta, showDelta }
    })
  }, [current, previous, metrics])

  return (
    <section
      aria-label="Period comparison summary"
      className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${className}`}
    >
      {cells.map(({ metric, currentValue, delta, showDelta }) => (
        <article
          key={metric.key}
          data-testid={`stat-card-${metric.key}`}
          className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-4 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
        >
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/70">
            {metric.label}
          </h3>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#0a0a0a]">
              {currentValue === null ? '—' : metric.formatValue(currentValue)}
            </span>
            {metric.unit && (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
                {metric.unit}
              </span>
            )}
          </p>
          {showDelta && delta !== null ? (
            <DeltaLine
              delta={delta}
              direction={metric.direction}
              format={metric.formatDelta ?? defaultDeltaFormatter(metric.formatValue)}
            />
          ) : (
            <p
              data-testid={`stat-card-${metric.key}-no-delta`}
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45"
            >
              No prior comparison
            </p>
          )}
        </article>
      ))}
    </section>
  )
}

interface DeltaLineProps {
  delta: PeriodDelta
  direction: CardioStatCardDirection
  format: (delta: number) => string
}

function DeltaLine({ delta, direction, format }: DeltaLineProps): JSX.Element {
  const arrow = delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '±'
  const colorClass = deltaColorClass(direction, delta.direction)
  const percentLabel =
    delta.percent === null
      ? ''
      : ` (${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%)`
  return (
    <p
      className={`mt-2 flex items-baseline gap-1 font-mono text-[11px] tabular-nums ${colorClass}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>
        {format(delta.absolute)}
        {percentLabel}
      </span>
    </p>
  )
}

/** Map (semantic direction, observed change) → tailwind text-color class. */
function deltaColorClass(
  direction: CardioStatCardDirection,
  change: DeltaDirection,
): string {
  if (direction === 'neutral' || change === 'same') return 'text-[#0a0a0a]/55'
  if (direction === 'higher-is-better') {
    return change === 'up' ? 'text-emerald-700' : 'text-red-700'
  }
  // direction === 'lower-is-better'
  return change === 'down' ? 'text-emerald-700' : 'text-red-700'
}

/** Default delta formatter — signed `formatValue` over the absolute change. */
function defaultDeltaFormatter(
  formatValue: (n: number) => string,
): (delta: number) => string {
  return (delta) => {
    const abs = Math.abs(delta)
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
    return `${sign}${formatValue(abs)}`
  }
}
