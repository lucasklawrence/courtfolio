import type { JSX } from 'react'

import { BaseLifestyleTrendChart, type LifestyleChartProps } from './BaseLifestyleTrendChart'

/**
 * Heart-rate variability (SDNN) daily trend. Higher = better recovery /
 * autonomic balance. Y-axis is integer milliseconds — typical range 30–80.
 */
export function HrvTrendChart(props: LifestyleChartProps): JSX.Element {
  return (
    <BaseLifestyleTrendChart
      {...props}
      yLabel="HRV (ms)"
      yTickFormat={(v) => String(Math.round(v))}
      emptyMessage="No HRV data in range"
      ariaLabel="HRV (SDNN) over time"
    />
  )
}
