import { useMemo, type JSX } from 'react'

import { ChartCard } from '@/components/training-facility/gym/ChartCard'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import type { CardioData } from '@/types/cardio'

import { ActiveEnergyTrendChart } from './ActiveEnergyTrendChart'
import { BodyMassTrendChart } from './BodyMassTrendChart'
import { HrvTrendChart } from './HrvTrendChart'
import { SleepTrendChart } from './SleepTrendChart'
import { StepCountTrendChart } from './StepCountTrendChart'
import { WalkingHrTrendChart } from './WalkingHrTrendChart'

/** Props for {@link LifestyleMetricsSection}. */
export interface LifestyleMetricsSectionProps {
  /** Cardio dataset — only the lifestyle-trend keys are read. */
  data: CardioData
  /** Active range from the parent's `DateFilter`. */
  range: DateRange
  /**
   * Pixel width to hand to each chart's `RoughLine` SVG. The parent
   * (`AllCardioOverview`) reuses the same `cardSizerRef` width that
   * drives the HR-zone bars card on the assumption that both grids
   * use `lg:grid-cols-2 gap-6` — see comment at the call site.
   */
  chartWidth: number
  /** Font family for axes / empty-state copy. */
  fontFamily: string
}

/**
 * "Lifestyle metrics" section (#75 slice C-ui) — six daily-trend charts
 * (HRV, walking HR, body mass, daily steps, sleep, active energy) ported
 * from `cardio-dashboard`. Sits between the activity mix and the session
 * log so the "what did I do" cards stay at the top of the page and the
 * detailed log stays at the bottom.
 *
 * Each chart is rendered inside its own `ChartCard` regardless of whether
 * the underlying field is populated — empty cards show "No <metric> data
 * in range" via `RoughLine`'s built-in empty-state rather than disappearing.
 * That keeps the page's structural rhythm stable across "fresh
 * import / partial dataset / fully populated" states and makes the empty
 * state a teaching moment ("import Apple Health to populate this").
 *
 * Lifted out of `AllCardioOverview.tsx` (#178 follow-up) so the parent
 * file stays under 600 lines and the lifestyle section sits with its
 * sibling chart wrappers.
 */
export function LifestyleMetricsSection({
  data,
  range,
  chartWidth,
  fontFamily,
}: LifestyleMetricsSectionProps): JSX.Element {
  // Memoize so the six chart wrappers receive a stable shared-props
  // reference until the inputs actually change. Without this the
  // object identity flips on every parent re-render and propagates a
  // useless prop change to all six children. (#178 follow-up)
  const sharedProps = useMemo(
    () => ({
      dateFrom: range.start,
      dateTo: range.end,
      width: chartWidth,
      fontFamily,
    }),
    [range.start, range.end, chartWidth, fontFamily],
  )
  return (
    <section aria-label="Lifestyle metrics" className="mt-8">
      <header className="mb-4">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white/80">
          Lifestyle metrics
        </h2>
        <p className="mt-1 text-xs text-white/55">
          Heart-rate variability, walking HR, body mass, daily steps, sleep,
          and active energy across the active range.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="HRV (SDNN)"
          helper="Daily heart-rate variability — higher trend = more recovered."
        >
          <HrvTrendChart points={data.hrv_trend} {...sharedProps} />
        </ChartCard>
        <ChartCard
          title="Walking heart rate"
          helper="Apple's per-day walking HR average — lower trend usually = better aerobic base."
        >
          <WalkingHrTrendChart points={data.walking_hr_trend} {...sharedProps} />
        </ChartCard>
        <ChartCard
          title="Body mass"
          helper="Daily latest reading, normalized to pounds at preprocess time."
        >
          <BodyMassTrendChart points={data.body_mass_trend} {...sharedProps} />
        </ChartCard>
        <ChartCard
          title="Daily steps"
          helper="Apple's per-burst step records summed into one total per local calendar day."
        >
          <StepCountTrendChart points={data.step_count_trend} {...sharedProps} />
        </ChartCard>
        <ChartCard
          title="Sleep"
          helper="Asleep-only hours per wake-day — in-bed-but-awake time is excluded."
        >
          <SleepTrendChart points={data.sleep_trend} {...sharedProps} />
        </ChartCard>
        <ChartCard
          title="Active energy"
          helper="Per-burst active-energy records summed per day. Rest days drop toward zero."
        >
          <ActiveEnergyTrendChart points={data.active_energy_trend} {...sharedProps} />
        </ChartCard>
      </div>
    </section>
  )
}
