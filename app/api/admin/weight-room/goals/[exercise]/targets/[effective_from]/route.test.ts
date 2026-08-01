import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { DELETE } from './route'

/**
 * Tests for `DELETE /api/admin/weight-room/goals/[exercise]/targets/[date]` —
 * cancelling a scheduled target change (#371). Auth and the service-role client
 * are mocked; the route's own rules (day-key validation, the past-is-history
 * 409, 404-vs-200) are exercised directly.
 *
 * The clock is pinned because the route's central decision — "is this row in the
 * future?" — is a comparison against today in Pacific.
 */

const requireAdminMock = vi.fn()
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const deleteMock = vi.fn()
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn((_column: string, _value: unknown) => supabaseChain),
  select: vi.fn(() => supabaseChain),
  maybeSingle: vi.fn(() => deleteMock()),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => supabaseChain,
}))

/** Route context — Next decodes both segments before the handler runs. */
function ctx(exercise: string, effectiveFrom: string) {
  return { params: Promise.resolve({ exercise, effective_from: effectiveFrom }) }
}

beforeEach(() => {
  vi.useFakeTimers()
  // Mid-afternoon Pacific on Aug 15 — comfortably inside one Pacific day, so
  // the assertions don't hinge on the UTC rollover.
  vi.setSystemTime(new Date('2026-08-15T12:00:00-07:00'))

  requireAdminMock.mockReset()
  deleteMock.mockReset()
  supabaseChain.from.mockClear()
  supabaseChain.delete.mockClear()
  supabaseChain.eq.mockClear()
  supabaseChain.select.mockClear()
  supabaseChain.maybeSingle.mockClear()
  requireAdminMock.mockResolvedValue({ ok: true })
  deleteMock.mockResolvedValue({
    data: { exercise: 'pullups', daily_target: 50, effective_from: '2026-09-01' },
    error: null,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DELETE goal target', () => {
  it('cancels a future scheduled change', async () => {
    const res = await DELETE({} as never, ctx('pullups', '2026-09-01') as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ effective_from: '2026-09-01' })
    expect(supabaseChain.from).toHaveBeenCalledWith('weight_room_goal_targets')
    expect(supabaseChain.eq).toHaveBeenCalledWith('exercise', 'pullups')
    expect(supabaseChain.eq).toHaveBeenCalledWith('effective_from', '2026-09-01')
  })

  it('refuses to delete a row that is already in effect', async () => {
    // Past entries are what every completed day was scored against — removing
    // one silently re-scores history, the exact thing #362 exists to prevent.
    const res = await DELETE({} as never, ctx('pullups', '2026-06-01') as never)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already in effect/i)
    expect(supabaseChain.delete).not.toHaveBeenCalled()
  })

  it("refuses today's own entry — it is current, not scheduled", async () => {
    const res = await DELETE({} as never, ctx('pullups', '2026-08-15') as never)
    expect(res.status).toBe(409)
    expect(supabaseChain.delete).not.toHaveBeenCalled()
  })

  it('rejects a malformed date rather than passing it to the query', async () => {
    const res = await DELETE({} as never, ctx('pullups', 'next-tuesday') as never)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/YYYY-MM-DD/)
    expect(supabaseChain.delete).not.toHaveBeenCalled()
  })

  it('rejects an empty exercise segment', async () => {
    const res = await DELETE({} as never, ctx('   ', '2026-09-01') as never)
    expect(res.status).toBe(400)
    expect(supabaseChain.delete).not.toHaveBeenCalled()
  })

  it('404s when no such scheduled row exists', async () => {
    deleteMock.mockResolvedValue({ data: null, error: null })
    const res = await DELETE({} as never, ctx('pullups', '2026-09-01') as never)
    expect(res.status).toBe(404)
  })

  it('surfaces a Supabase failure as a 500', async () => {
    deleteMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await DELETE({} as never, ctx('pullups', '2026-09-01') as never)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/boom/)
  })

  it('honours the admin gate', async () => {
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'nope' }, { status: 403 }),
    })
    const res = await DELETE({} as never, ctx('pullups', '2026-09-01') as never)
    expect(res.status).toBe(403)
    expect(supabaseChain.delete).not.toHaveBeenCalled()
  })
})
