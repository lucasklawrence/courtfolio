import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { E2E_ADMIN_COOKIE_NAME } from '@/e2e/helpers/admin-constants'

import {
  E2E_ADMIN_COOKIE,
  E2E_ADMIN_EMAIL,
  isE2eAdminStubActive,
  isE2eAdminStubEnabled,
  isLoopbackUrl,
} from './e2e-admin-stub'
import { requireAdmin } from './require-admin'
import { requireAdminPage } from './require-admin-page'

/**
 * The e2e admin stub is security-sensitive (#481): it grants the admin session
 * without credentials. These pin that it fails closed, and in particular that
 * it is inert in the state every deployed server runs in, `NODE_ENV=production`,
 * even with every other condition deliberately met.
 */

class NotFoundSentinel extends Error {}

const cookieValues = new Map<string, string>()
const getUserMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieValues.has(name) ? { name, value: cookieValues.get(name) } : undefined,
  }),
}))

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

/** Every condition for the stub met: dev server, flag, loopback Supabase, cookie. */
function meetEveryCondition(): void {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('E2E_ADMIN_STUB', '1')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54329')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'e2e-anon-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'e2e-service-role-key')
  vi.stubEnv('ADMIN_EMAILS', 'owner@example.com')
  cookieValues.set(E2E_ADMIN_COOKIE, '1')
}

beforeEach(() => {
  cookieValues.clear()
  getUserMock.mockReset()
  // No real session anywhere in this file: only the stub can grant admin.
  getUserMock.mockResolvedValue({ data: { user: null }, error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isLoopbackUrl', () => {
  it.each(['http://127.0.0.1:54329', 'http://localhost:54329', 'http://[::1]:54329'])(
    'accepts %s',
    url => expect(isLoopbackUrl(url)).toBe(true)
  )

  it.each([
    'https://abcdefghijklmnop.supabase.co',
    'http://127.0.0.1.attacker.example',
    'http://localhost.example.com',
    'not a url',
    '',
    undefined,
  ])('rejects %s', url => expect(isLoopbackUrl(url)).toBe(false))
})

describe('the e2e admin stub', () => {
  it('grants the admin session when every condition holds', async () => {
    meetEveryCondition()
    expect(isE2eAdminStubEnabled()).toBe(true)
    await expect(isE2eAdminStubActive()).resolves.toBe(true)
    await expect(requireAdminPage()).resolves.toEqual({ email: E2E_ADMIN_EMAIL })
    await expect(requireAdmin()).resolves.toEqual({ ok: true, email: E2E_ADMIN_EMAIL })
  })

  describe('in a production build (next build, next start, every Vercel deploy)', () => {
    it('is inert even with the flag, a loopback Supabase and the cookie', async () => {
      meetEveryCondition()
      vi.stubEnv('NODE_ENV', 'production')
      expect(isE2eAdminStubEnabled()).toBe(false)
      await expect(isE2eAdminStubActive()).resolves.toBe(false)
    })

    it('still 404s the admin pages and refuses the admin API', async () => {
      meetEveryCondition()
      vi.stubEnv('NODE_ENV', 'production')
      await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
      const api = await requireAdmin()
      expect(api.ok).toBe(false)
      if (!api.ok) expect(api.response.status).toBe(401)
    })
  })

  it('is inert without the flag', async () => {
    meetEveryCondition()
    vi.stubEnv('E2E_ADMIN_STUB', '')
    await expect(isE2eAdminStubActive()).resolves.toBe(false)
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })

  it('is inert when Supabase points at a real project, so it can never write one', async () => {
    meetEveryCondition()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co')
    await expect(isE2eAdminStubActive()).resolves.toBe(false)
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })

  it('is inert for a request without the cookie, or with another value', async () => {
    meetEveryCondition()
    cookieValues.delete(E2E_ADMIN_COOKIE)
    await expect(isE2eAdminStubActive()).resolves.toBe(false)
    cookieValues.set(E2E_ADMIN_COOKIE, 'true')
    await expect(isE2eAdminStubActive()).resolves.toBe(false)
    await expect(requireAdminPage()).rejects.toBeInstanceOf(NotFoundSentinel)
  })

  it('never reports an address that could be on the allowlist', () => {
    expect(E2E_ADMIN_EMAIL.endsWith('.test')).toBe(true)
  })

  it('uses the cookie name the Playwright helper sets', () => {
    expect(E2E_ADMIN_COOKIE_NAME).toBe(E2E_ADMIN_COOKIE)
  })
})
