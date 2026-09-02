/**
 * Tests for the shared filter-href builder (#438).
 *
 * The rule that matters is `null` meaning *remove*, not "write empty" — the
 * exercise filter distinguishes `?exercises=` (nothing selected) from an absent
 * param (everything selected), so conflating the two silently resets a filter.
 */
import { describe, expect, it } from 'vitest'

import { buildFilterHref } from './filter-href'

const PATH = '/training-facility/weight-room/history'

describe('buildFilterHref', () => {
  it('returns a bare pathname when nothing survives', () => {
    expect(buildFilterHref(PATH, { span: null })).toBe(PATH)
    expect(buildFilterHref(PATH, {})).toBe(PATH)
  })

  it('links an absolute pathname, not a query-only relative href', () => {
    // Next's <Link> does not resolve `?span=all` against the current route.
    expect(buildFilterHref(PATH, { span: 'all' })).toBe(`${PATH}?span=all`)
  })

  it('drops null params and keeps empty-string ones', () => {
    // Present-but-empty is a meaningful state for the exercise filter.
    expect(buildFilterHref(PATH, { exercises: '', span: null })).toBe(`${PATH}?exercises=`)
  })

  it('encodes values that need it', () => {
    expect(buildFilterHref(PATH, { exercises: 'pullups,squats' })).toBe(
      `${PATH}?exercises=pullups%2Csquats`
    )
  })

  it('preserves carried params alongside the one being written', () => {
    const href = buildFilterHref(PATH, { preview: 'demo', span: 'all' })
    expect(href).toContain('preview=demo')
    expect(href).toContain('span=all')
  })
})
