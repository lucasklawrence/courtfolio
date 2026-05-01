import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdminSupabaseClient } from './admin'

const createClientMock =
  vi.fn<(url: string, key: string, options?: unknown) => unknown>(() => ({
    from: vi.fn(),
  }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string, options?: unknown) =>
    createClientMock(url, key, options),
}))

beforeEach(() => {
  createClientMock.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createAdminSupabaseClient', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv_key')
    expect(() => createAdminSupabaseClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(() => createAdminSupabaseClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('passes both env values + session-disabled options to createClient', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv_key')
    createAdminSupabaseClient()
    expect(createClientMock).toHaveBeenCalledWith(
      'https://abc.supabase.co',
      'srv_key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )
  })
})
