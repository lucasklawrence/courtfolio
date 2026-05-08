import type { JSX } from 'react'

import { BaseLifestyleTrendChart } from './BaseLifestyleTrendChart'
import type { LifestyleChartProps } from './BaseLifestyleTrendChart'

/**
 * Daily active-energy total, **kilocalories**. Summed from per-burst
 * records at preprocess time; kJ exports are normalized to kcal so the
 * y-axis units stay consistent across export sources.
 */
export function ActiveEnergyTrendChart(props: LifestyleChartProps): JSX.Element {
  return (
    <BaseLifestyleTrendChart
      {...props}
      yLabel="kcal"
      yTickFormat={(v) => String(Math.round(v))}
      emptyMessage="No active energy data in range"
      ariaLabel="Active energy burned per day over time"
    />
  )
}
