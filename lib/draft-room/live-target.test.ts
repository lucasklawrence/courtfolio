// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { courtfolioPanelResult } from '@/app/draft-room/panelResult'
import { DRAFT_ROOM_PERSONAS } from '@/lib/panel/personas'

import { PANEL_STAGE_LIMITS } from './limits'
import {
  COURTFOLIO_THESIS,
  LIVE_TARGETS,
  lensByPersonaId,
  livePanelConfig,
  modelByPersonaId,
} from './live-target'

/**
 * Tests the live panel's fixed inputs. Merely importing `live-target` is part
 * of the contract: the committed baked evidence JSON is zod-parsed at module
 * load, so a malformed re-bake fails these tests before it fails a paid run.
 */

describe('COURTFOLIO_THESIS', () => {
  it('matches the stored replay thesis verbatim (drift guard — edit both together or not at all)', () => {
    expect(COURTFOLIO_THESIS).toEqual(courtfolioPanelResult.thesis)
  })
})

describe('LIVE_TARGETS.courtfolio', () => {
  it('exists with schema-valid baked evidence for the courtfolio target', () => {
    const target = LIVE_TARGETS.courtfolio
    expect(target).toBeDefined()
    expect(target.evidence.targetId).toBe('courtfolio')
    expect(target.evidence.artifacts.length).toBeGreaterThan(0)
  })

  it('keeps the baked evidence under the size budget (brake against a ballooned re-bake)', () => {
    expect(JSON.stringify(LIVE_TARGETS.courtfolio.evidence).length).toBeLessThan(20_000)
  })
})

describe('livePanelConfig', () => {
  it('applies the #241 stage limits on top of the portfolio config', () => {
    expect(livePanelConfig.limits).toBe(PANEL_STAGE_LIMITS)
  })

  it('runs the draft-room persona set — the front office judges live runs (#302)', () => {
    expect(livePanelConfig.personas).toBe(DRAFT_ROOM_PERSONAS)
    expect(livePanelConfig.personas.map(p => p.id)).toEqual(['gm', 'scout', 'coach'])
  })
})

describe('modelByPersonaId', () => {
  it("maps every persona id to its family's lineup model", () => {
    const map = modelByPersonaId(livePanelConfig)

    expect(Object.keys(map).sort()).toEqual(livePanelConfig.personas.map(p => p.id).sort())
    for (const persona of livePanelConfig.personas) {
      expect(map[persona.id]).toBe(livePanelConfig.lineup.personas[persona.family])
    }
  })
})

describe('lensByPersonaId', () => {
  it('maps every persona id to its lens line', () => {
    const map = lensByPersonaId(livePanelConfig)

    expect(Object.keys(map).sort()).toEqual(livePanelConfig.personas.map(p => p.id).sort())
    for (const persona of livePanelConfig.personas) {
      expect(map[persona.id]).toBe(persona.lens)
    }
  })
})
