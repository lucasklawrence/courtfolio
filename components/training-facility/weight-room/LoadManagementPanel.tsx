import type { JSX } from 'react'

import { RoughSparkline } from '@/components/training-facility/shared/charts/RoughSparkline'
import { RAMP_FLAGS } from '@/constants/ramp-rate'
import type { MovementLoad } from '@/lib/training-facility/load-management'

/** Sparkline box size, in px. Fixed so every card's trend reads at the same scale. */
const SPARK_WIDTH = 220
const SPARK_HEIGHT = 44

/** Props for {@link LoadManagementPanel}. */
export interface LoadManagementPanelProps {
  /**
   * One pre-computed entry per actively-ramped movement — see
   * {@link import('@/lib/training-facility/load-management').buildMovementLoads}.
   * Empty array renders the empty-state message.
   */
  loads: readonly MovementLoad[]
}

/**
 * Load Management panel for the Weight Room History View (#316). One card
 * per movement surfacing the tendon-load ramp signals: trailing-7-day
 * volume, week-over-week change, ACWR, a 28-day trailing sparkline, and a
 * color-coded flag (worst of the WoW and ACWR signals). Read-only.
 *
 * Purely presentational — all bucketing and threshold logic lives in
 * `buildMovementLoads` / `constants/ramp-rate`, so this component only
 * formats and lays out. Cream cards on the dark Weight Room surface,
 * matching {@link import('./StrengthStats').StrengthStats}.
 */
export function LoadManagementPanel({ loads }: LoadManagementPanelProps): JSX.Element {
  if (loads.length === 0) {
    return (
      <p
        data-testid="load-management-empty"
        className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
      >
        No movements logged in the last 28 days — start logging sets to track ramp rate.
      </p>
    )
  }

  return (
    <section aria-label="Load management" className="grid gap-4 md:grid-cols-2">
      {loads.map(load => (
        <MovementLoadCard key={load.movement} load={load} />
      ))}
    </section>
  )
}

interface MovementLoadCardProps {
  load: MovementLoad
}

function MovementLoadCard({ load }: MovementLoadCardProps): JSX.Element {
  const flagMeta = RAMP_FLAGS[load.flag]
  const volumeLabel = load.metric === 'load' ? '7d load volume' : '7d rep volume'

  return (
    <article
      data-testid={`load-card-${load.movement}`}
      data-flag={load.flag}
      aria-label={`${load.movement}: ${flagMeta.label}`}
      className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3
          className="font-mono text-sm font-bold uppercase tracking-[0.2em]"
          style={{ color: load.color }}
        >
          {load.movement}
        </h3>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: flagMeta.color }}
          />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/70">
            {flagMeta.label}
          </span>
        </span>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <p className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {formatVolume(load.acute7d)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/60">
              {load.unitLabel}
            </span>
          </p>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/65">
            {volumeLabel}
          </p>
        </div>

        <MetricCell label="WoW" value={formatWow(load.wowPct)} flag={load.wowFlag} />
        <MetricCell label="ACWR" value={formatAcwr(load.acwr)} flag={load.acwrFlag} />
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
          Trailing 28 days
        </p>
        <div className="overflow-x-auto">
          <RoughSparkline
            points={load.sparkline.map((p, i) => ({ x: i, y: p.volume }))}
            width={SPARK_WIDTH}
            height={SPARK_HEIGHT}
            stroke={load.color}
            ariaLabel={`${load.movement} 28-day ${load.metric === 'load' ? 'load' : 'rep'} volume trend`}
          />
        </div>
      </div>
    </article>
  )
}

interface MetricCellProps {
  label: string
  value: string
  flag: MovementLoad['flag']
}

/**
 * One numeric ramp signal (WoW or ACWR). Tints the value with the flag
 * color so an elevated signal reads at a glance without relying on the
 * card's overall dot alone.
 */
function MetricCell({ label, value, flag }: MetricCellProps): JSX.Element {
  const flagMeta = RAMP_FLAGS[flag]
  return (
    <div>
      <p
        className="font-mono text-3xl font-semibold tabular-nums"
        style={{ color: flag === 'green' ? undefined : flagMeta.color }}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/65">
        {label}
      </p>
    </div>
  )
}

/** Format an absolute volume with thousands separators, no decimals. */
function formatVolume(volume: number): string {
  return Math.round(volume).toLocaleString('en-US')
}

/**
 * Format a week-over-week change as a signed whole-percent, or `—` when
 * there's no prior week to compare against.
 */
function formatWow(wowPct: number | null): string {
  if (wowPct == null || !Number.isFinite(wowPct)) return '—'
  const pct = Math.round(wowPct * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

/** Format an ACWR to two decimals, or `—` when there's no chronic baseline. */
function formatAcwr(acwr: number | null): string {
  if (acwr == null || !Number.isFinite(acwr)) return '—'
  return acwr.toFixed(2)
}
