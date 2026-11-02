import type { JSX } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OtfSparklineSummary } from '@/components/training-facility/gym/OtfSparklineSummary'
import { TrainingLoadChart } from '@/components/training-facility/gym/TrainingLoadChart'
import { StrengthVsBodyweightChart } from '@/components/training-facility/weight-room/StrengthVsBodyweightChart'
import { parseSessionDate } from '@/lib/training-facility/cardio-shared'
import { otfLinearRegression, type OtfTrendPoint } from '@/lib/training-facility/otf'
import { computeTrainingLoad, dailyTrimpSeries } from '@/lib/training-facility/training-load'
import type { CardioSession } from '@/types/cardio'
import type { Benchmark } from '@/types/movement'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'
import { BodyweightOverlay } from './BodyweightOverlay'
import { RoughLine } from './RoughLine'

/**
 * Renders each chart once per timezone and compares the markup, which is what the
 * server and a viewer's browser each do during hydration.
 *
 * The sessions span the US clock change on 2026-11-01 and include evening
 * timestamps. In a zone that changes its clocks the real gap between two sessions
 * gains an hour, so a chart that derives a position from `Date.getTime()` comes out
 * differently from one rendered in UTC.
 */

const ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Pago_Pago'] as const

/** Evening Pacific sessions, either side of the clock change. */
const SESSION_DATES = [
  '2026-10-20T03:14:05Z',
  '2026-10-27T04:30:00Z',
  '2026-11-03T05:15:00Z',
  '2026-11-10T02:45:00Z',
]

const ORIGINAL_TZ = process.env.TZ

/** Render `build` in every zone. It runs per zone, because a wall-clock `Date` is built per zone. */
function renderInEachZone(build: () => JSX.Element): string[] {
  return ZONES.map(zone => {
    process.env.TZ = zone
    return renderToString(build())
  })
}

/** Assert all renders match, reporting only the first place they differ. */
function expectSameMarkup([first, ...rest]: string[]): void {
  for (const html of rest) {
    let at = 0
    while (at < html.length && html[at] === first[at]) at++
    expect(html.slice(Math.max(0, at - 40), at + 40)).toBe(
      first.slice(Math.max(0, at - 40), at + 40)
    )
    expect(html.length).toBe(first.length)
  }
}

/** A trend whose values rise with time, with one point per session. */
function trend(): OtfTrendPoint[] {
  return SESSION_DATES.map((date, i) => ({ date: parseSessionDate(date), value: 100 + i * 7 }))
}

function sessions(): CardioSession[] {
  return SESSION_DATES.map(date => ({
    date,
    activity: 'running',
    duration_seconds: 1800,
    avg_hr: 150,
  })) as CardioSession[]
}

describe('charts across timezones', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-25T20:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('can actually change zone in this test runner', () => {
    process.env.TZ = 'UTC'
    const utcOffset = new Date(2026, 0, 1).getTimezoneOffset()
    process.env.TZ = 'Asia/Tokyo'
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(utcOffset)
  })

  it('RoughLine and its regression overlay render the same in every zone', () => {
    const renders = renderInEachZone(() => {
      const points = trend()
      const line = otfLinearRegression(points)
      return (
        <RoughLine
          data={points}
          x={p => p.date}
          y={p => p.value}
          overlay={line?.points.map(p => ({ x: p.date, y: p.value }))}
          width={720}
          height={280}
          ariaLabel="trend"
        />
      )
    })
    expectSameMarkup(renders)
  })

  it('TrainingLoadChart renders the same in every zone', () => {
    const renders = renderInEachZone(() => (
      <TrainingLoadChart
        points={computeTrainingLoad(dailyTrimpSeries(sessions(), { maxHr: 185 }))}
        width={720}
        height={280}
        ariaLabel="load"
      />
    ))
    expectSameMarkup(renders)
  })

  it('StrengthVsBodyweightChart, built from real instants, renders the same in every zone', () => {
    const sets = ['2026-10-14T18:00:00Z', '2026-10-21T18:00:00Z', '2026-11-04T18:00:00Z'].map(
      (logged_at, i) => ({ id: String(i), logged_at, exercise: 'pullups', reps: 10 + i })
    ) as StrengthSet[]
    const renders = renderInEachZone(() => (
      <StrengthVsBodyweightChart
        sets={sets}
        goal={{ exercise: 'pullups', color: '#EA580C' } as ExerciseGoal}
        bodyMass={[{ date: '2026-10-20', value: 236 }]}
      />
    ))
    expectSameMarkup(renders)
  })

  it('BodyweightOverlay counts a benchmark on the first day of the range in every zone', () => {
    const benchmarks = [{ date: '2026-05-01', bodyweight_lbs: 236 }] as Benchmark[]
    const renders = renderInEachZone(() => (
      <BodyweightOverlay
        benchmarks={benchmarks}
        dateExtent={[parseSessionDate('2026-05-01'), parseSessionDate('2026-05-31')]}
        width={720}
        height={280}
      >
        <svg />
      </BodyweightOverlay>
    ))
    expectSameMarkup(renders)
    expect(renders[0]).not.toContain('disabled')
  })

  it('OtfSparklineSummary renders the same in every zone', () => {
    const renders = renderInEachZone(() => (
      <OtfSparklineSummary
        rows={[{ key: 'watts', label: 'Watts', trend: trend(), format: String }]}
        ariaLabelPrefix="Rower"
      />
    ))
    expectSameMarkup(renders)
  })
})
