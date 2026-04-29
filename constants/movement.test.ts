import { describe, expect, it } from 'vitest'
import {
  RIM_HEIGHT_IN,
  STANDING_REACH_IN,
  inchesToRim,
  jumpTouchInches,
} from './movement'

describe('movement constants', () => {
  it('exposes documented v1 anchor values', () => {
    expect(STANDING_REACH_IN).toBe(80)
    expect(RIM_HEIGHT_IN).toBe(120)
  })
})

describe('jumpTouchInches', () => {
  it('adds vertical to the default standing reach', () => {
    expect(jumpTouchInches(22)).toBe(102)
  })

  it('honors a caller-provided standing reach override', () => {
    expect(jumpTouchInches(22, 84)).toBe(106)
  })

  it('returns undefined when vertical is missing — empty-state contract', () => {
    expect(jumpTouchInches(undefined)).toBeUndefined()
  })
})

describe('inchesToRim', () => {
  it('measures the gap from current jump-touch to the rim', () => {
    expect(inchesToRim(102)).toBe(18)
  })

  it('clamps at zero once jump-touch reaches the rim — celebration takes over', () => {
    expect(inchesToRim(120)).toBe(0)
    expect(inchesToRim(125)).toBe(0)
  })

  it('honors a caller-provided rim height override', () => {
    expect(inchesToRim(110, 115)).toBe(5)
  })

  it('returns undefined when jump-touch is missing', () => {
    expect(inchesToRim(undefined)).toBeUndefined()
  })
})
