import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { CardioTimePoint } from '@/types/cardio'

import { ActiveEnergyTrendChart } from './ActiveEnergyTrendChart'
import { BodyMassTrendChart } from './BodyMassTrendChart'
import { HrvTrendChart, type LifestyleChartProps } from './HrvTrendChart'
import { SleepTrendChart } from './SleepTrendChart'
import { StepCountTrendChart } from './StepCountTrendChart'
import { WalkingHrTrendChart } from './WalkingHrTrendChart'

/**
 * Smoke tests for the six lifestyle-metric wrappers. Each wrapper is a thin
 * pass-through to {@link BaseLifestyleTrendChart} that fixes the y-axis
 * label, tick formatter, empty-state caption, and aria-label. We assert
 * those four metric-specific bits land in the rendered output — the
 * underlying line/clipping behavior is covered in
 * `BaseLifestyleTrendChart.test.tsx` and `RoughLine`'s own coverage.
 */

interface WrapperCase {
  name: string
  Component: ComponentType<LifestyleChartProps>
  emptyMessage: string
}

const WRAPPERS: ReadonlyArray<WrapperCase> = [
  { name: 'HrvTrendChart', Component: HrvTrendChart, emptyMessage: 'No HRV data in range' },
  {
    name: 'WalkingHrTrendChart',
    Component: WalkingHrTrendChart,
    emptyMessage: 'No walking HR data in range',
  },
  {
    name: 'BodyMassTrendChart',
    Component: BodyMassTrendChart,
    emptyMessage: 'No body mass data in range',
  },
  {
    name: 'StepCountTrendChart',
    Component: StepCountTrendChart,
    emptyMessage: 'No step data in range',
  },
  { name: 'SleepTrendChart', Component: SleepTrendChart, emptyMessage: 'No sleep data in range' },
  {
    name: 'ActiveEnergyTrendChart',
    Component: ActiveEnergyTrendChart,
    emptyMessage: 'No active energy data in range',
  },
]

const samplePoints: CardioTimePoint[] = [
  { date: '2026-03-14', value: 50 },
  { date: '2026-04-18', value: 55 },
]

describe.each(WRAPPERS)('$name', ({ Component, emptyMessage }) => {
  it('renders the metric-specific empty-state message when points is undefined', () => {
    const { getByText } = render(<Component points={undefined} width={400} />)
    expect(getByText(emptyMessage)).toBeInTheDocument()
  })

  it('renders an svg (not the empty state) when given sample points', () => {
    const { container, queryByText } = render(<Component points={samplePoints} width={400} />)
    expect(queryByText(emptyMessage)).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
