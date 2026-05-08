import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdminPage } from './require-admin-page'

/**
 * Same shape as the `requireAdmin` test (#180): the Supabase server
 * client is mocked to return a controlled `auth.getUser()` payload, so
 * the three policy outcomes (signed-in admin, signed-in non-admin, no
 * session) can be exercised without a real project.
 *
 * `notFound()` from `next/navigation` is mocked to throw a tagged
 * sentinel so the tests can distinguish "rejected" from "happy path"
 * without depending on Next's actual error type.
 */

class NotFoundSentinel extends Error {}

const getUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: () => getUserMock() },
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundSentinel('NEXT_NOT_FOUND')
  },
}))

beforeEach(() => {
  getUserMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireAdminPage', () => {
  it('returns the verified email when the signed-in user is on the allowlist', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'lucas@example.com' } },
      error: null,
    })
    await expect(requireAdminPage()).resolves.toEqual({ email: 'lucas@example.com' })
  })

  it('calls notFound() when no session is present', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })

  it('calls notFound() when Supabase returns an auth error', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT malformed' },
    })
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })

  it('calls notFound() when the signed-in email is not on the allowlist', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: 'intruder@example.com' } },
      error: null,
    })
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })

  it('calls notFound() when the user has no email at all', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'lucas@example.com')
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: null } },
      error: null,
    })
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })
})
