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
