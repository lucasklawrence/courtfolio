import { afterEach, describe, expect, it, vi } from 'vitest'

import { requireSupabaseEnv } from './env'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireSupabaseEnv', () => {
  it('returns the trimmed url + anon key when both are set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '  https://abc.supabase.co  ')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '  sb_publishable_xyz  ')
    expect(requireSupabaseEnv()).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'sb_publishable_xyz',
    })
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'k')
    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is whitespace-only', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '   ')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'k')
    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is whitespace-only', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '   ')
    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })
})
