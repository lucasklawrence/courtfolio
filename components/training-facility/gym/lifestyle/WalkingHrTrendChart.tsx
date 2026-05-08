import type { JSX } from 'react'

import { BaseLifestyleTrendChart } from './BaseLifestyleTrendChart'
import type { LifestyleChartProps } from './BaseLifestyleTrendChart'

/**
 * Walking heart-rate average daily trend, BPM. Apple's per-day rollup of
 * heart rates measured during sustained walking. Lower trend usually =
 * better aerobic fitness.
 */
export function WalkingHrTrendChart(props: LifestyleChartProps): JSX.Element {
  return (
    <BaseLifestyleTrendChart
      {...props}
      yLabel="BPM"
      yTickFormat={(v) => String(Math.round(v))}
      emptyMessage="No walking HR data in range"
      ariaLabel="Walking heart rate over time"
    />
  )
}
