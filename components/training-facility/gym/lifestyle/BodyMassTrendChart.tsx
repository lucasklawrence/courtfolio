import type { JSX } from 'react'

import { BaseLifestyleTrendChart } from './BaseLifestyleTrendChart'
import type { LifestyleChartProps } from './BaseLifestyleTrendChart'

/**
 * Body-mass daily trend, **lbs** (Apple Health's `kg` is converted at
 * preprocess time, see `scripts/preprocess-health.py`). One decimal of
 * precision so day-to-day fluctuation reads naturally.
 */
export function BodyMassTrendChart(props: LifestyleChartProps): JSX.Element {
  return (
    <BaseLifestyleTrendChart
      {...props}
      yLabel="lbs"
      yTickFormat={(v) => v.toFixed(1)}
      emptyMessage="No body mass data in range"
      ariaLabel="Body mass over time"
    />
  )
}
