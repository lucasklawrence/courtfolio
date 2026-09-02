import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdmin } from './require-admin'

/**
 * Tests the route-handler admin gate. The Supabase server client is
 * mocked to return a controlled `{ data, error }` from `auth.getUser()`
 * so we exercise the three policy outcomes (signed-in admin, signed-in
 * non-admin, no session) without needing a real Supabase project.
 */

const getUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: () => getUserMock(),
    },
  }),
}))

beforeEach(() => {
  getUserMock.mockReset()
  // The gate now also requires the service-role credential, so the default for
  // every case is "writes are possible" — the 503 tests clear it explicitly.
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'srv_key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireAdmin', () => {
  it('returns ok with the verified email when the signed-in user is on the allowlist', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'lucas@example.com' } },
      error: null,
    })
    const result = await requireAdmin()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.email).toBe('lucas@example.com')
  })

  describe('write-capability gate (preview deployments)', () => {
    it('returns 503 for an allowlisted admin when the service-role key is absent', async () => {
      vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
      getUserMock.mockResolvedValueOnce({
        data: { user: { email: 'lucas@example.com' } },
        error: null,
      })
      const result = await requireAdmin()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        // 503, not the opaque 500 the client factory used to throw into.
        expect(result.response.status).toBe(503)
        const body = await result.response.json()
        expect(body.error).toMatch(/unavailable on this deployment/i)
      }
    })

    it('returns 503 when the Supabase URL is absent', async () => {
      vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
      getUserMock.mockResolvedValueOnce({
        data: { user: { email: 'lucas@example.com' } },
        error: null,
      })
      const result = await requireAdmin()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(503)
    })

    it('still answers 401 before 503 — config is not disclosed to anonymous callers', async () => {
      vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
      const result = await requireAdmin()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    })

    it('still answers 403 before 503 for a signed-in non-admin', async () => {
      vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
      getUserMock.mockResolvedValueOnce({
        data: { user: { email: 'intruder@example.com' } },
        error: null,
      })
      const result = await requireAdmin()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(403)
    })
  })

  it('returns 401 when no session is present', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const body = await result.response.json()
      expect(body.error).toMatch(/sign in/i)
    }
  })

  it('returns 401 when Supabase returns an auth error', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT malformed' },
    })
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('returns 403 when the signed-in email is NOT on the allowlist', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'intruder@example.com' } },
      error: null,
    })
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toMatch(/admin only/i)
    }
  })

  it('returns 403 when the user has no email at all (defensive)', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: null } },
      error: null,
    })
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})
