import { describe, it, expect } from 'vitest'
import {
  classifyDelta,
  deriveCombineScoreboardCells,
  pickMetricBaseline,
  pickMetricLatest,
  SCOREBOARD_METRIC_ORDER,
} from './scoreboard-utils'
import type { Benchmark } from '@/types/movement'

const baseline: Benchmark = {
  date: '2026-01-15',
  bodyweight_lbs: 240.5,
  shuttle_5_10_5_s: 5.62,
  vertical_in: 19.5,
  sprint_10y_s: 1.98,
}

const middle: Benchmark = {
  date: '2026-02-15',
  bodyweight_lbs: 237.0,
  shuttle_5_10_5_s: 5.5,
  vertical_in: 20.5,
  sprint_10y_s: 1.95,
}

const latest: Benchmark = {
  date: '2026-04-15',
  bodyweight_lbs: 231.4,
  shuttle_5_10_5_s: 5.38,
  vertical_in: 22.0,
  sprint_10y_s: 1.91,
}

describe('pickMetricLatest', () => {
  it('returns the most recent value for the metric', () => {
    expect(pickMetricLatest([baseline, middle, latest], 'vertical_in')).toBe(22.0)
  })

  it('does not depend on input order', () => {
    expect(pickMetricLatest([latest, baseline, middle], 'vertical_in')).toBe(22.0)
  })

  it('skips entries marked is_complete: false', () => {
    const incomplete: Benchmark = { ...latest, is_complete: false }
    expect(pickMetricLatest([baseline, middle, incomplete], 'vertical_in')).toBe(20.5)
  })

  it('skips entries lacking a value for the requested metric (per-metric latest)', () => {
    // A bodyweight-only "weekly" entry should not block a later vertical
    // jump entry from being the vertical latest.
    const partial: Benchmark = { date: '2026-04-20', bodyweight_lbs: 230 }
    expect(pickMetricLatest([baseline, latest, partial], 'vertical_in')).toBe(22.0)
    expect(pickMetricLatest([baseline, latest, partial], 'bodyweight_lbs')).toBe(230)
  })

  it('returns undefined when no entry has the metric', () => {
    expect(pickMetricLatest([], 'vertical_in')).toBeUndefined()
    const onlyBodyweight: Benchmark = { date: '2026-03-01', bodyweight_lbs: 235 }
    expect(pickMetricLatest([onlyBodyweight], 'vertical_in')).toBeUndefined()
  })
})

describe('pickMetricBaseline', () => {
  it('returns the earliest value for the metric', () => {
    expect(pickMetricBaseline([baseline, middle, latest], 'vertical_in')).toBe(19.5)
  })

  it('uses per-metric baseline so a later entry can baseline a metric the earliest entry lacked', () => {
    const veryEarly: Benchmark = { date: '2026-01-01', bodyweight_lbs: 245 } // no vertical
    expect(pickMetricBaseline([veryEarly, baseline, latest], 'vertical_in')).toBe(19.5)
    expect(pickMetricBaseline([veryEarly, baseline, latest], 'bodyweight_lbs')).toBe(245)
  })

  it('skips entries marked is_complete: false even if they are earliest', () => {
    const incomplete: Benchmark = { ...baseline, is_complete: false }
    expect(pickMetricBaseline([incomplete, middle, latest], 'vertical_in')).toBe(20.5)
  })

  it('returns undefined when no entry has the metric', () => {
    expect(pickMetricBaseline([], 'vertical_in')).toBeUndefined()
  })
})

describe('classifyDelta + display precision (sub-precision noise should not flag improvement)', () => {
  // Real-world scenario: shuttle precision is 2 decimals. A raw delta of
  // -0.003 (5.381 vs 5.384) classifies as "improvement" mathematically
  // but renders as "Δ −0.00s", which is misleading. The view layer
  // suppresses the line by rounding to display precision before deciding;
  // these unit tests pin the classifier behavior on raw inputs so the
  // rule is documented and the upstream call site can rely on it.
  it('still classifies sub-precision improvements as improvement on raw inputs', () => {
    expect(classifyDelta(5.381, 5.384, 'lower')).toBe('improvement')
  })
})

describe('classifyDelta', () => {
  it('lower-is-better: smaller latest is improvement', () => {
    expect(classifyDelta(5.38, 5.62, 'lower')).toBe('improvement')
  })

  it('lower-is-better: larger latest is regression', () => {
    expect(classifyDelta(5.7, 5.62, 'lower')).toBe('regression')
  })

  it('higher-is-better: larger latest is improvement', () => {
    expect(classifyDelta(22.0, 19.5, 'higher')).toBe('improvement')
  })

  it('higher-is-better: smaller latest is regression', () => {
    expect(classifyDelta(18.0, 19.5, 'higher')).toBe('regression')
  })

  it('returns neutral for identical values', () => {
    expect(classifyDelta(20.0, 20.0, 'lower')).toBe('neutral')
    expect(classifyDelta(20.0, 20.0, 'higher')).toBe('neutral')
  })

  it('returns null when either side is missing', () => {
    expect(classifyDelta(undefined, 20.0, 'higher')).toBeNull()
    expect(classifyDelta(22.0, undefined, 'higher')).toBeNull()
    expect(classifyDelta(undefined, undefined, 'lower')).toBeNull()
  })
})

describe('deriveCombineScoreboardCells', () => {
  it('returns four cells in PRD §9.1 order', () => {
    const cells = deriveCombineScoreboardCells([baseline, middle, latest])
    expect(cells.map((c) => c.label)).toEqual(['WT', '5-10-5', 'VERT', '10Y'])
    expect(SCOREBOARD_METRIC_ORDER).toEqual([
      'bodyweight_lbs',
      'shuttle_5_10_5_s',
      'vertical_in',
      'sprint_10y_s',
    ])
  })

  it('binds latest value, baseline, direction, precision, and unit per cell', () => {
    const cells = deriveCombineScoreboardCells([baseline, middle, latest])
    const vert = cells.find((c) => c.label === 'VERT')!
    expect(vert.value).toBe(22.0)
    expect(vert.baseline).toBe(19.5)
    expect(vert.direction).toBe('higher')
    expect(vert.precision).toBe(1)
    expect(vert.unit).toBe('"')

    const shuttle = cells.find((c) => c.label === '5-10-5')!
    expect(shuttle.value).toBe(5.38)
    expect(shuttle.baseline).toBe(5.62)
    expect(shuttle.direction).toBe('lower')
    expect(shuttle.precision).toBe(2)
    expect(shuttle.unit).toBe('s')
  })

  it('emits cells with undefined value/baseline when history is empty', () => {
    const cells = deriveCombineScoreboardCells([])
    for (const cell of cells) {
      expect(cell.value).toBeUndefined()
      expect(cell.baseline).toBeUndefined()
    }
  })

  it('with a single entry, value === baseline so no delta is implied', () => {
    const cells = deriveCombineScoreboardCells([baseline])
    for (const cell of cells) {
      expect(cell.value).toBe(cell.baseline)
    }
  })
})
