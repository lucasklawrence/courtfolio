import type { JSX } from 'react'

import { BaseLifestyleTrendChart } from './BaseLifestyleTrendChart'
import type { LifestyleChartProps } from './BaseLifestyleTrendChart'

/**
 * Daily step-count total, summed from Apple's per-burst step records at
 * preprocess time. Tick labels use locale grouping (`12,400`) so the
 * common 5–6 figure values stay readable.
 */
export function StepCountTrendChart(props: LifestyleChartProps): JSX.Element {
  return (
    <BaseLifestyleTrendChart
      {...props}
      yLabel="Steps"
      yTickFormat={(v) => Math.round(v).toLocaleString()}
      emptyMessage="No step data in range"
      ariaLabel="Daily step count over time"
    />
  )
}
