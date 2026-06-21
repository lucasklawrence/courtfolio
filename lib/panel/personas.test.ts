import { describe, expect, it } from 'vitest'
import { DRAFT_ROOM_PERSONAS, PORTFOLIO_PERSONAS } from './personas'
import type { Persona } from './types'

function assertWellFormed(set: Persona[]) {
  const ids = set.map(p => p.id)
  expect(new Set(ids).size).toBe(ids.length) // unique ids
  expect(new Set(set.map(p => p.family)).size).toBeGreaterThanOrEqual(2) // cross-family
  for (const p of set) {
    expect(p.label.length).toBeGreaterThan(0)
    expect(p.systemPrompt.length).toBeGreaterThan(40)
    expect(p.lens.length).toBeGreaterThan(0)
  }
}

describe('persona registries', () => {
  it('the default portfolio set is well-formed and spans families', () => {
    assertWellFormed(PORTFOLIO_PERSONAS)
    expect(PORTFOLIO_PERSONAS.map(p => p.id)).toContain('skeptical-peer')
  })

  it('the draft-room set is well-formed and spans families', () => {
    assertWellFormed(DRAFT_ROOM_PERSONAS)
    expect(DRAFT_ROOM_PERSONAS.map(p => p.id)).toContain('gm')
  })
})
