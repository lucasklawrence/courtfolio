// @vitest-environment node

import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  isGymEnabled,
  isPanelLiveEnabled,
  isTrainingFacilityEnabled,
  isWeightRoomEnabled,
} from './feature-flags'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isTrainingFacilityEnabled', () => {
  it('returns true only when the env var is exactly the string "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', 'true')
    expect(isTrainingFacilityEnabled()).toBe(true)
  })

  it('returns false when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', '')
    expect(isTrainingFacilityEnabled()).toBe(false)
  })

  it.each(['false', 'TRUE', '1', 'yes', 'on'])(
    'returns false for any non-"true" string (%s) — defensive against truthy-coercion bugs',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', value)
      expect(isTrainingFacilityEnabled()).toBe(false)
    },
  )
})

describe('isGymEnabled', () => {
  it('returns true only when the env var is exactly the string "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', 'true')
    expect(isGymEnabled()).toBe(true)
  })

  it('returns false when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', '')
    expect(isGymEnabled()).toBe(false)
  })

  it.each(['false', 'TRUE', '1', 'yes', 'on'])(
    'returns false for any non-"true" string (%s) — defensive against truthy-coercion bugs',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', value)
      expect(isGymEnabled()).toBe(false)
    },
  )
})

describe('isWeightRoomEnabled', () => {
  it('returns true only when the env var is exactly the string "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM', 'true')
    expect(isWeightRoomEnabled()).toBe(true)
  })

  it('returns false when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM', '')
    expect(isWeightRoomEnabled()).toBe(false)
  })

  it.each(['false', 'TRUE', '1', 'yes', 'on'])(
    'returns false for any non-"true" string (%s) — defensive against truthy-coercion bugs',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM', value)
      expect(isWeightRoomEnabled()).toBe(false)
    },
  )
})

/**
 * The regression the #345 split exists to prevent: these three gate different
 * surfaces, and publishing one must never publish another. A shared env var,
 * a copy-paste in the flag body, or a stray `||` between them would all be
 * invisible to the per-flag tests above.
 */
describe('flag independence', () => {
  it('leaves the other two off when only the gym flag is set', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_GYM', 'true')
    expect(isGymEnabled()).toBe(true)
    expect(isWeightRoomEnabled()).toBe(false)
    expect(isTrainingFacilityEnabled()).toBe(false)
  })

  it('leaves the other two off when only the weight-room flag is set', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM', 'true')
    expect(isWeightRoomEnabled()).toBe(true)
    expect(isGymEnabled()).toBe(false)
    expect(isTrainingFacilityEnabled()).toBe(false)
  })

  it('does not publish the gym or weight room via the lobby flag', () => {
    // The pre-split behaviour: this one env var used to open everything.
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TRAINING_FACILITY', 'true')
    expect(isTrainingFacilityEnabled()).toBe(true)
    expect(isGymEnabled()).toBe(false)
    expect(isWeightRoomEnabled()).toBe(false)
  })
})

describe('isPanelLiveEnabled', () => {
  it('returns true only when the env var is exactly the string "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PANEL_LIVE', 'true')
    expect(isPanelLiveEnabled()).toBe(true)
  })

  it('returns false when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PANEL_LIVE', '')
    expect(isPanelLiveEnabled()).toBe(false)
  })

  it.each(['false', 'TRUE', '1', 'yes', 'on'])(
    'returns false for any non-"true" string (%s) — defensive against truthy-coercion bugs',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_PANEL_LIVE', value)
      expect(isPanelLiveEnabled()).toBe(false)
    },
  )
})
