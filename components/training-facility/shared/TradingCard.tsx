'use client'

import { useMemo, useState, type CSSProperties, type JSX } from 'react'
import { motion } from 'framer-motion'
import type { Benchmark } from '@/types/movement'

/**
 * Display config for the four Tier-1 Combine metrics rendered on the card.
 * Lives inline until issue #57 lands a shared `BENCHMARKS` config module —
 * at that point this collapses into an import. Keeps the component
 * self-contained for now without coupling to a not-yet-merged module.
 */
type MetricKey = 'vertical_in' | 'shuttle_5_10_5_s' | 'sprint_10y_s' | 'bodyweight_lbs'

interface MetricSpec {
  key: MetricKey
  /** Three-letter card-back label (Panini-style brevity). */
  label: string
  /** Suffix appended after the value on the front of the card. */
  unit: string
  /** 'lower' = times/weight (less is more athletic); 'higher' = vertical jump. */
  direction: 'lower' | 'higher'
  /** Decimal places to render. */
  precision: number
}

/**
 * The four Tier-1 Combine metrics rendered on the card, in display order
 * (top of the front face, left-to-right on the back-of-card history table).
 * Both the front stat list and the back table iterate this array, so adding
 * or reordering a metric is a single-source-of-truth edit. Replaced by an
 * import from the shared `BENCHMARKS` config when issue #57 lands.
 */
const METRICS: readonly MetricSpec[] = [
  { key: 'vertical_in', label: 'VERT', unit: '"', direction: 'higher', precision: 1 },
  { key: 'shuttle_5_10_5_s', label: '5-10-5', unit: 's', direction: 'lower', precision: 2 },
  { key: 'sprint_10y_s', label: '10Y', unit: 's', direction: 'lower', precision: 2 },
  { key: 'bodyweight_lbs', label: 'WT', unit: ' lbs', direction: 'lower', precision: 1 },
] as const

/** Props for {@link TradingCard}. */
export interface TradingCardProps {
  /** The card's subject — the entry whose stats fill the front. Usually the latest benchmark. */
  entry: Benchmark
  /** Full benchmark history (including `entry`). Used to detect personal bests and to populate the back-of-card mini-table. Order doesn't matter; the card sorts internally. */
  history: Benchmark[]
  /** Display label rendered at the bottom of the front face. Defaults to a season derived from `entry.date`. */
  season?: string
  /** Optional jersey number painted on the top of the front face. Defaults to "00". */
  playerNumber?: string | number
  /** Optional player name. Defaults to "Combine ’26" framing label. */
  playerName?: string
  /** Tailwind classes appended to the card's outer container. */
  className?: string
  /** How many history rows to show on the back. Defaults to 5 (newest first). */
  historyLimit?: number
}

/**
 * Determine whether `entry`'s value for `metric` is strictly better than
 * every PRIOR entry (date < `entry.date`). Returns false when the entry
 * has no value for the metric, or when no prior entry has one
 * (you can't break a record that doesn't exist). The "prior only"
 * comparison matters when the card is used to browse a non-latest entry:
 * a March session shouldn't lose its PB badge just because April beat it.
 */
function isPersonalBest(entry: Benchmark, history: readonly Benchmark[], spec: MetricSpec): boolean {
  const value = entry[spec.key]
  if (typeof value !== 'number') return false
  const priorValues = history
    .filter((h) => h.date < entry.date && h.is_complete !== false && typeof h[spec.key] === 'number')
    .map((h) => h[spec.key] as number)
  if (priorValues.length === 0) return false
  return spec.direction === 'lower'
    ? priorValues.every((v) => value < v)
    : priorValues.every((v) => value > v)
}

/** Format a benchmark value for the front-of-card line, or em-dash when absent. */
function formatValue(value: number | undefined, spec: MetricSpec): string {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(spec.precision)}${spec.unit}`
}

/** Derive a "2026 Spring"-style season label from a `YYYY-MM-DD` benchmark date. */
function seasonFromDate(date: string): string {
  const [yearStr, monthStr] = date.split('-')
  const month = Number(monthStr)
  const season =
    month >= 3 && month <= 5
      ? 'Spring'
      : month >= 6 && month <= 8
        ? 'Summer'
        : month >= 9 && month <= 11
          ? 'Fall'
          : 'Winter'
  return `${yearStr} ${season}`
}

/**
 * `TradingCard` — Panini/NBA-2K-style flippable benchmark card (PRD §9.2).
 *
 * Front renders the entry's stats. Back reveals a mini history table and
 * the latest notes. Tap/click flips between faces. A small PB badge
 * pulses on the front whenever the entry sets a new record on any
 * metric (per-metric PB is checked against `history`).
 *
 * The card is data-shape-driven (PRD §7.13): it takes a `Benchmark` plus
 * its history and emits no state. It does not assume the entry belongs to
 * any particular user, so it stays reusable when multi-tenancy lands.
 *
 * See {@link TradingCardProps} for prop-level docs on each field.
 *
 * @param props - {@link TradingCardProps}.
 */
export function TradingCard({
  entry,
  history,
  season,
  playerNumber = '00',
  playerName = 'Combine ’26',
  className = '',
  historyLimit = 5,
}: TradingCardProps): JSX.Element {
  const [flipped, setFlipped] = useState(false)

  /** PB flags for each metric on the front, plus a single "any PB" indicator for the badge. */
  const pbState = useMemo(() => {
    const perMetric = new Map<MetricKey, boolean>()
    let any = false
    for (const spec of METRICS) {
      const isPb = isPersonalBest(entry, history, spec)
      perMetric.set(spec.key, isPb)
      if (isPb) any = true
    }
    return { perMetric, any }
  }, [entry, history])

  /** Newest-first history slice rendered on the back (always includes `entry`). */
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, historyLimit)
  }, [history, historyLimit])

  const seasonLabel = season ?? seasonFromDate(entry.date)

  // 3D flip needs preserve-3d on the parent and backface-hidden on each face.
  // Tailwind ships these as `[transform-style:preserve-3d]` arbitraries which
  // are reliable across browsers; CSS variables here keep the magic numbers
  // readable in one place.
  const cardStyle: CSSProperties = {
    transformStyle: 'preserve-3d',
    perspective: '1000px',
  }

  return (
    <motion.button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={`Trading card for ${seasonLabel} — ${flipped ? 'showing history, click to show stats' : 'showing stats, click to show history'}`}
      whileHover={{ rotate: 1.2, y: -3 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      style={cardStyle}
      className={`relative block w-[250px] cursor-pointer rounded-xl border border-amber-300/40 bg-transparent p-0 text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${className}`}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative aspect-[5/7] w-full"
      >
        <CardFront
          entry={entry}
          pbState={pbState}
          seasonLabel={seasonLabel}
          playerNumber={playerNumber}
          playerName={playerName}
        />
        <CardBack history={sortedHistory} latestNotes={entry.notes} />
      </motion.div>
    </motion.button>
  )
}

interface CardFrontProps {
  entry: Benchmark
  pbState: { perMetric: Map<MetricKey, boolean>; any: boolean }
  seasonLabel: string
  playerNumber: string | number
  playerName: string
}

function CardFront({ entry, pbState, seasonLabel, playerNumber, playerName }: CardFrontProps): JSX.Element {
  return (
    <div
      // backfaceVisibility hides this face when rotated 180°; the parent's
      // preserve-3d makes the rotation actually go through space rather
      // than collapsing to a 2D scale.
      style={{ backfaceVisibility: 'hidden' }}
      className="absolute inset-0 flex flex-col rounded-xl border border-amber-300/30 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black px-4 pb-4 pt-3 text-amber-100"
    >
      <header className="flex items-baseline justify-between border-b border-amber-300/20 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
          {playerName}
        </span>
        <span className="font-sans text-3xl font-extrabold text-orange-400 leading-none">
          #{playerNumber}
        </span>
      </header>

      <ul className="mt-3 flex flex-col gap-1.5 font-mono text-sm">
        {METRICS.map((spec) => {
          const value = entry[spec.key]
          const isPb = pbState.perMetric.get(spec.key)
          return (
            <li
              key={spec.key}
              className="flex items-baseline justify-between gap-2 border-b border-amber-300/10 pb-1 last:border-b-0"
            >
              <span className="text-[11px] uppercase tracking-wider text-amber-300/70">
                {spec.label}
              </span>
              <span className="flex items-baseline gap-1.5 text-amber-50">
                {isPb && (
                  <span aria-label="personal best" className="text-orange-400" title="Personal best">
                    ★
                  </span>
                )}
                <span className="font-semibold tabular-nums">
                  {formatValue(value, spec)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <footer className="mt-auto flex items-end justify-between pt-3 text-[11px] uppercase tracking-wider">
        <span className="font-mono text-amber-300/70">{seasonLabel}</span>
        {pbState.any && (
          <motion.span
            // Pulse the PB badge gently; spring on `scale` keeps it organic.
            // Repeat-yoyo style via Framer's `repeatType: "reverse"`.
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="rounded-full border border-orange-400/70 bg-orange-500/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.5)]"
          >
            ★ PB
          </motion.span>
        )}
      </footer>
    </div>
  )
}

interface CardBackProps {
  history: readonly Benchmark[]
  latestNotes?: string
}

function CardBack({ history, latestNotes }: CardBackProps): JSX.Element {
  return (
    <div
      // The back face is rotated 180° on Y so it sits behind the front in
      // 3D; backfaceVisibility hidden on both faces means only the
      // currently-front-facing one renders.
      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      className="absolute inset-0 flex flex-col rounded-xl border border-amber-300/30 bg-gradient-to-b from-amber-100/95 to-amber-50/95 p-4 text-neutral-900"
    >
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-700">
        Career Log
      </h3>
      <table className="mt-2 w-full text-[11px] font-mono">
        <thead>
          <tr className="border-b border-neutral-700/30 text-left text-[10px] uppercase tracking-wider text-neutral-600">
            <th className="font-semibold">Date</th>
            {METRICS.map((spec) => (
              <th key={spec.key} className="font-semibold">
                {spec.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr>
              <td colSpan={1 + METRICS.length} className="pt-2 text-center text-neutral-500">
                No prior sessions
              </td>
            </tr>
          )}
          {history.map((row) => (
            <tr key={row.date} className="border-b border-neutral-700/10 last:border-b-0">
              <td className="py-1 text-neutral-700">{row.date.slice(5)}</td>
              {METRICS.map((spec) => (
                <td key={spec.key} className="py-1 tabular-nums">
                  {formatCell(row[spec.key], spec)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {latestNotes && (
        <section className="mt-auto pt-3">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-700">
            Notes
          </h4>
          <p className="mt-1 line-clamp-4 text-[11px] leading-snug text-neutral-800">
            {latestNotes}
          </p>
        </section>
      )}
    </div>
  )
}

/**
 * Compact cell value for the back-of-card history table. Honors the
 * metric's declared precision so timed metrics (shuttle, 10y) keep their
 * hundredths digit instead of rounding 1.98 → 2.0.
 */
function formatCell(value: number | undefined, spec: MetricSpec): string {
  if (typeof value !== 'number') return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(spec.precision)
}
