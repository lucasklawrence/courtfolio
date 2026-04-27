// @vitest-environment node

import { afterEach, describe, it, expect, vi } from 'vitest'
import { isTrainingFacilityEnabled } from './feature-flags'

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
