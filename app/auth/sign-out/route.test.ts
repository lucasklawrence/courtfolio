import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'

/**
 * Tests the sign-out route's redirect contract. Native `<form>` POSTs
 * (the only caller — see CombineEntryForm) follow whatever the server
 * returns; the route must therefore 303 in both the happy path and
 * the Supabase-failure path so the user never lands on a raw JSON
 * error page (#151 / CodeRabbit major nit).
 */

const signOutMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { signOut: () => signOutMock() },
  }),
}))

beforeEach(() => {
  signOutMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/auth/sign-out', { method: 'POST' })
}

describe('POST /auth/sign-out', () => {
  it('303-redirects to / on success', async () => {
    signOutMock.mockResolvedValueOnce({ error: null })
    const res = await POST(makeRequest())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  it('still 303-redirects to / when Supabase reports a sign-out error (does NOT return JSON 500)', async () => {
    // Suppress the route's intentional console.error so the test
    // output stays clean; assert it was called so we know the failure
    // is being surfaced for ops-side debugging.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutMock.mockResolvedValueOnce({ error: { message: 'Network unreachable' } })

    const res = await POST(makeRequest())

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost/')
    expect(res.headers.get('content-type') ?? '').not.toMatch(/json/)
    expect(errSpy).toHaveBeenCalledWith(
      '[auth/sign-out] Supabase signOut failed:',
      'Network unreachable',
    )
  })

  it('still 303-redirects when supabase.auth.signOut() throws (CodeRabbit Major)', async () => {
    // The Supabase SDK can reject with a thrown error on transport
    // failures rather than returning `{ error }`. The handler must
    // still produce a 303 — bubbling the exception would land the
    // user on a Next.js 500 page, defeating the fail-soft design.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const thrown = new Error('socket hang up')
    signOutMock.mockRejectedValueOnce(thrown)

    const res = await POST(makeRequest())

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost/')
    expect(res.headers.get('content-type') ?? '').not.toMatch(/json/)
    expect(errSpy).toHaveBeenCalledWith(
      '[auth/sign-out] Supabase signOut threw:',
      thrown,
    )
  })
})
