import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

/**
 * Tests the boolean-only admin probe used by the browser hook.
 * Mocks the server Supabase client's `auth.getUser()` to drive the
 * three states the hook needs to distinguish: signed-out, signed-in
 * non-admin, signed-in admin.
 */

const getUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: () => getUserMock() },
  }),
}))

beforeEach(() => {
  getUserMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/admin/check', () => {
  it('returns { isAdmin: false, email: null } when no session', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAdmin: false, email: null })
  })

  it('returns { isAdmin: false, email: null } when getUser errors (treats as logged-out)', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT malformed' },
    })
    const res = await GET()
    expect(await res.json()).toEqual({ isAdmin: false, email: null })
  })

  it('returns { isAdmin: false, email } for a signed-in non-admin', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'intruder@example.com' } },
      error: null,
    })
    const res = await GET()
    expect(await res.json()).toEqual({
      isAdmin: false,
      email: 'intruder@example.com',
    })
  })

  it('returns { isAdmin: true, email } when the email is on the allowlist (case-insensitive)', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'Lucas@Example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'lucas@example.com' } },
      error: null,
    })
    const res = await GET()
    expect(await res.json()).toEqual({
      isAdmin: true,
      email: 'lucas@example.com',
    })
  })

  it('does NOT leak the allowlist itself in the response', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com,foo@bar.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'lucas@example.com' } },
      error: null,
    })
    const res = await GET()
    const body = await res.json()
    // Only the boolean + the caller's own email — never the list.
    expect(Object.keys(body).sort()).toEqual(['email', 'isAdmin'])
    expect(JSON.stringify(body)).not.toContain('foo@bar.com')
  })
})
