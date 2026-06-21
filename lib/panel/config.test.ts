import { describe, expect, it } from 'vitest'
import { assertValidConfig, portfolioConfig } from './config'
import type { PanelConfig } from './types'

describe('assertValidConfig', () => {
  it('accepts the default portfolio config', () => {
    expect(() => assertValidConfig(portfolioConfig)).not.toThrow()
  })

  it('rejects a config with no personas', () => {
    expect(() => assertValidConfig({ ...portfolioConfig, personas: [] })).toThrow(/no personas/)
  })

  it('rejects a config with no axes', () => {
    expect(() => assertValidConfig({ ...portfolioConfig, axes: [] })).toThrow(/no axes/)
  })

  it('rejects a single-family panel (no cross-family diversity)', () => {
    const oneFamily: PanelConfig = {
      ...portfolioConfig,
      personas: portfolioConfig.personas.map(p => ({ ...p, family: 'anthropic' as const })),
    }
    expect(() => assertValidConfig(oneFamily)).toThrow(/one model family/)
  })

  it('rejects a persona family with a missing or blank model in the lineup', () => {
    const missingModel: PanelConfig = {
      ...portfolioConfig,
      lineup: {
        ...portfolioConfig.lineup,
        personas: { ...portfolioConfig.lineup.personas, google: '   ' },
      },
    }
    expect(() => assertValidConfig(missingModel)).toThrow(/no model for it/)
  })

  it('rejects a blank meta-judge model id', () => {
    const cfg: PanelConfig = {
      ...portfolioConfig,
      lineup: { ...portfolioConfig.lineup, metaJudge: '' },
    }
    expect(() => assertValidConfig(cfg)).toThrow(/no metaJudge model/)
  })

  it('rejects a blank verifier model id', () => {
    const cfg: PanelConfig = {
      ...portfolioConfig,
      lineup: { ...portfolioConfig.lineup, verifier: '  ' },
    }
    expect(() => assertValidConfig(cfg)).toThrow(/no verifier model/)
  })
})

describe('portfolioConfig', () => {
  it('scores on two distinct axes', () => {
    expect(portfolioConfig.axes.map(a => a.id)).toEqual(['learning-value', 'portfolio-signal'])
  })
})
