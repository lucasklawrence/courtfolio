/**
 * Tests for the OTF booking title / studio parser (#453).
 *
 * Focus is the two rules the rest of the feature rests on: the grammar must
 * cover every observed title (including the HYROX variant that broke the
 * original taxonomy), and an unrecognized title must degrade to all-null rather
 * than a partial guess — a fabricated format would poison the analysis this
 * feature exists to fix.
 */
import { describe, expect, it } from 'vitest'

import {
  isOtfBookingTitle,
  normalizeStudio,
  parseBookingTitle,
  studioMatchKey,
} from './otf-booking-parser.mjs'

describe('parseBookingTitle', () => {
  it('parses a standard class with no program variant', () => {
    expect(parseBookingTitle('Orange 60 Min 2G')).toEqual({
      program: null,
      durationMin: 60,
      format: '2G',
    })
  })

  it('parses the 3G template', () => {
    expect(parseBookingTitle('Orange 60 Min 3G')).toEqual({
      program: null,
      durationMin: 60,
      format: '3G',
    })
  })

  // 2026-08-05. This variant was unknown when the feature was specced and is
  // the reason `format` is free text rather than an enum.
  it('parses a program variant without mistaking it for the duration', () => {
    expect(parseBookingTitle('Orange HYROX 60 Min 2G')).toEqual({
      program: 'HYROX',
      durationMin: 60,
      format: '2G',
    })
  })

  it('keeps a multi-word format whole', () => {
    expect(parseBookingTitle('Orange 60 Min Tread 50')).toEqual({
      program: null,
      durationMin: 60,
      format: 'Tread 50',
    })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseBookingTitle('  Orange 60 Min 2G  ')).toEqual({
      program: null,
      durationMin: 60,
      format: '2G',
    })
  })

  it.each([
    ['an empty string', ''],
    ['an unrelated event', 'Dentist appointment'],
    ['a bare prefix', 'Orange'],
    ['a title with no format', 'Orange 60 Min'],
    ['a title with no duration', 'Orange Min 2G'],
    ['a title missing the Min separator', 'Orange 60Min 2G'],
  ])('returns all-null for %s rather than guessing', (_label, title) => {
    expect(parseBookingTitle(title)).toEqual({
      program: null,
      durationMin: null,
      format: null,
    })
  })

  it.each([[null], [undefined], [42]])('returns all-null for the non-string %s', input => {
    expect(parseBookingTitle(input as unknown as string)).toEqual({
      program: null,
      durationMin: null,
      format: null,
    })
  })
})

describe('isOtfBookingTitle', () => {
  // Looser than the full grammar on purpose: the source is the shared "Home"
  // calendar, so "not an OTF booking" and "an OTF booking we can't parse" are
  // different outcomes and must not collapse into one.
  it.each([
    ['Orange 60 Min 2G'],
    ['Orange HYROX 60 Min 2G'],
    ['orange 60 min 2g'],
    ['  Orange something we have never seen'],
  ])('accepts %s', title => {
    expect(isOtfBookingTitle(title)).toBe(true)
  })

  it.each([['Dentist appointment'], ['Orangetheory'], [''], [null], [undefined]])(
    'rejects %s',
    title => {
      expect(isOtfBookingTitle(title as unknown as string)).toBe(false)
    }
  )
})

describe('normalizeStudio', () => {
  it('strips a trailing state suffix', () => {
    expect(normalizeStudio('Marina Del Rey, CA')).toBe('Marina Del Rey')
  })

  it('leaves a bare studio name alone', () => {
    expect(normalizeStudio('Marina Del Rey')).toBe('Marina Del Rey')
  })

  it('collapses whitespace and trims', () => {
    expect(normalizeStudio('  Playa   Vista , CA ')).toBe('Playa Vista')
  })

  it.each([[''], ['   '], [null], [undefined]])('returns null for %s', input => {
    expect(normalizeStudio(input as unknown as string)).toBeNull()
  })
})

describe('studioMatchKey', () => {
  // The join must treat the OTbeat email's "Marina Del Rey, CA" and the
  // calendar's "Marina Del Rey" as one studio.
  it('matches the same studio written both ways', () => {
    expect(studioMatchKey('Marina Del Rey, CA')).toBe(studioMatchKey('Marina Del Rey'))
  })

  it('is case-insensitive', () => {
    expect(studioMatchKey('marina del rey')).toBe(studioMatchKey('Marina Del Rey'))
  })

  // Studio is part of the join key precisely so two locations running a class
  // at the same clock time can't be confused for each other.
  it('keeps different studios distinct', () => {
    expect(studioMatchKey('Mar Vista, CA')).not.toBe(studioMatchKey('Marina Del Rey, CA'))
  })

  it('returns null when there is no studio', () => {
    expect(studioMatchKey(null)).toBeNull()
  })
})
