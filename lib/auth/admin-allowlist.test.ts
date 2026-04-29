import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAdminAllowlist, isAdminEmail } from './admin-allowlist'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getAdminAllowlist', () => {
  it('returns an empty Set when ADMIN_EMAILS is unset', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(getAdminAllowlist().size).toBe(0)
  })

  it('parses a single email', () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    expect([...getAdminAllowlist()]).toEqual(['lucas@example.com'])
  })

  it('parses comma-separated lists with whitespace', () => {
    vi.stubEnv('ADMIN_EMAILS', '  lucas@example.com ,  foo@bar.com  ')
    expect(getAdminAllowlist()).toEqual(
      new Set(['lucas@example.com', 'foo@bar.com']),
    )
  })

  it('lowercases entries so casing differences do not bypass the gate', () => {
    vi.stubEnv('ADMIN_EMAILS', 'Lucas@Example.com,Foo@BAR.COM')
    expect(getAdminAllowlist()).toEqual(
      new Set(['lucas@example.com', 'foo@bar.com']),
    )
  })

  it('drops empty fragments produced by trailing/extra commas', () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@b.com,,, , c@d.com,')
    expect(getAdminAllowlist()).toEqual(new Set(['a@b.com', 'c@d.com']))
  })
})

describe('isAdminEmail', () => {
  it('returns false for null/undefined input', () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })

  it('matches the allowlist case-insensitively', () => {
    vi.stubEnv('ADMIN_EMAILS', 'Lucas@Example.com')
    expect(isAdminEmail('lucas@example.com')).toBe(true)
    expect(isAdminEmail('LUCAS@EXAMPLE.COM')).toBe(true)
  })

  it('returns false when the email is not on the list', () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    expect(isAdminEmail('intruder@example.com')).toBe(false)
  })

  it('returns false when the allowlist is empty (no admin configured)', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(isAdminEmail('lucas@example.com')).toBe(false)
  })
})
