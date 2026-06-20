import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'

/**
 * Tests the magic-link callback's redirect + telemetry contract (#227).
 * Both failure branches return 3xx redirects, which the `withTelemetry`
 * wrapper labels `status='ok'` — so each must also emit an
 * `auth_callback_failed` domain event with a low-cardinality reason
 * (never the Supabase error message) for the App-health dashboard.
 *
 * Sibling pattern: `app/auth/sign-out/route.test.ts`.
 */

const exchangeMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession: (code: string) => exchangeMock(code) },
  }),
}))

vi.mock('@/lib/telemetry/client', () => ({
  emitEvent: (...args: unknown[]) => emitEventMock(...args),
  flush: vi.fn(),
}))

beforeEach(() => {
  exchangeMock.mockReset()
  emitEventMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/auth/callback${query}`)
}

/** The `auth_callback_failed` emissions captured by the telemetry mock. */
function failureEvents(): unknown[][] {
  return emitEventMock.mock.calls.filter(([name]) => name === 'auth_callback_failed')
}

describe('GET /auth/callback', () => {
  it('redirects to next and emits no failure event on success', async () => {
    exchangeMock.mockResolvedValueOnce({ error: null })

    const res = await GET(makeRequest('?code=abc&next=/locker-room'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/locker-room')
    expect(failureEvents()).toHaveLength(0)
  })

  it('redirects to login and emits reason=missing_code when ?code= is absent', async () => {
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost/admin/login?error=missing_code',
    )
    expect(failureEvents()).toEqual([
      ['auth_callback_failed', { status: 'error', attributes: { reason: 'missing_code' } }],
    ])
    expect(exchangeMock).not.toHaveBeenCalled()
  })

  it('redirects to login and emits reason=exchange_failed when the code exchange errors', async () => {
    exchangeMock.mockResolvedValueOnce({
      error: { message: 'invalid request: both auth code and code verifier should be non-empty' },
    })

    const res = await GET(makeRequest('?code=expired'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin/login?error=')
    // The reason is the fixed bucket, never the Supabase message — error
    // messages can carry user input and must not reach telemetry.
    expect(failureEvents()).toEqual([
      ['auth_callback_failed', { status: 'error', attributes: { reason: 'exchange_failed' } }],
    ])
  })

  it('sanitizes an absolute ?next= to / on success', async () => {
    exchangeMock.mockResolvedValueOnce({ error: null })

    const res = await GET(makeRequest('?code=abc&next=https://evil.example'))

    expect(res.headers.get('location')).toBe('http://localhost/')
  })
})
