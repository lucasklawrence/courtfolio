import type { JSX } from 'react'

import { BaseLifestyleTrendChart } from './BaseLifestyleTrendChart'
import type { LifestyleChartProps } from './BaseLifestyleTrendChart'

/**
 * Sleep daily trend, **hours**. Each block is bucketed by its wake-day at
 * preprocess time (Apple Health's UI convention) and only
 * `HKCategoryValueSleepAnalysisAsleep*` periods are summed — in-bed-but-
 * awake time is excluded.
 */
export function SleepTrendChart(props: LifestyleChartProps): JSX.Element {
  return (
    <BaseLifestyleTrendChart
      {...props}
      yLabel="Hours"
      yTickFormat={(v) => v.toFixed(1)}
      emptyMessage="No sleep data in range"
      ariaLabel="Asleep hours per night over time"
    />
  )
}
