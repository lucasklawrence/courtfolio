import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { APPLE_HEALTH_SOURCE, upsertStrengthSessions } from './weight-room-supabase.mjs'

/**
 * Coverage for the Apple Health strength import (#413).
 *
 * This is the least-observable code in the pipeline — a Node script with no
 * preview to eyeball and no page to click — and the two ways it could go wrong
 * are both silent: writing 507 duplicate sessions on a re-import, or reaching
 * into manually recorded sessions that it has no business touching.
 */

/**
 * Minimal Supabase stub capturing what `.upsert()` was called with.
 *
 * Cast rather than mocked wholesale: the writer touches exactly `.from().upsert()`,
 * and standing up the other 25 members of `SupabaseClient` to satisfy the type
 * would obscure that.
 */
function stubClient() {
  const calls: Array<{ table: string; rows: unknown[]; options: unknown }> = []
  const client = {
    from(table: string) {
      return {
        upsert(rows: unknown[], options: unknown) {
          calls.push({ table, rows, options })
          return Promise.resolve({ error: null })
        },
      }
    },
  } as unknown as SupabaseClient
  return { client, calls }
}

function session(startedAt: string, overrides: Record<string, unknown> = {}) {
  return {
    started_at: startedAt,
    ended_at: '2019-03-04T18:47:00-07:00',
    duration_seconds: 2820,
    avg_hr: 112,
    max_hr: 148,
    ...overrides,
  }
}

describe('upsertStrengthSessions', () => {
  it('writes to weight_room_workouts, not to a cardio table', async () => {
    const { client, calls } = stubClient()
    await upsertStrengthSessions(client, [session('2019-03-04T18:00:00-07:00')])
    expect(calls[0].table).toBe('weight_room_workouts')
  })

  it('stamps the provenance every row needs to be distinguishable', async () => {
    const { client, calls } = stubClient()
    await upsertStrengthSessions(client, [session('2019-03-04T18:00:00-07:00')])
    expect(calls[0].rows[0]).toMatchObject({
      source: APPLE_HEALTH_SOURCE,
      started_at: '2019-03-04T18:00:00-07:00',
      avg_hr: 112,
      max_hr: 148,
    })
  })

  it('conflicts on (source, started_at) — the only key the export supports', async () => {
    // Health's <Workout> elements carry no UUID, so a second import of the same
    // export must collide on the start instant or it duplicates 8.5 years.
    const { client, calls } = stubClient()
    await upsertStrengthSessions(client, [session('2019-03-04T18:00:00-07:00')])
    expect(calls[0].options).toEqual({ onConflict: 'source,started_at' })
  })

  it('never sets a location, because Health does not record one', async () => {
    const { client, calls } = stubClient()
    await upsertStrengthSessions(client, [session('2019-03-04T18:00:00-07:00')])
    expect(calls[0].rows[0]).not.toHaveProperty('location')
  })

  it('collapses a duplicated start inside one payload', async () => {
    // The DB would reject the whole batch on the unique index, and "duplicate
    // key" is a long way from the cause.
    const { client, calls } = stubClient()
    const result = await upsertStrengthSessions(client, [
      session('2019-03-04T18:00:00-07:00', { max_hr: 100 }),
      session('2019-03-04T18:00:00-07:00', { max_hr: 148 }),
    ])
    expect(result.upserted).toBe(1)
    expect(calls[0].rows).toHaveLength(1)
    expect(calls[0].rows[0]).toMatchObject({ max_hr: 148 })
  })

  it('normalises a missing HR to null rather than dropping the column', async () => {
    const { client, calls } = stubClient()
    await upsertStrengthSessions(client, [
      {
        started_at: '2020-01-01T10:00:00Z',
        ended_at: '2020-01-01T11:00:00Z',
        duration_seconds: 3600,
      },
    ])
    expect(calls[0].rows[0]).toMatchObject({ avg_hr: null, max_hr: null })
  })

  it('does nothing at all for an empty or absent payload', async () => {
    const { client, calls } = stubClient()
    expect(await upsertStrengthSessions(client, [])).toEqual({ upserted: 0 })
    // `strength_sessions` is optional on the payload schema, so a JSON produced
    // before #413 reaches this as undefined rather than as an empty array.
    expect(await upsertStrengthSessions(client, undefined as unknown as never[])).toEqual({
      upserted: 0,
    })
    expect(calls).toHaveLength(0)
  })

  it('batches a full-history import instead of one giant request', async () => {
    const { client, calls } = stubClient()
    // 507 distinct instants, one per hour — the real import's size.
    const base = Date.parse('2019-01-01T00:00:00Z')
    const many = Array.from({ length: 507 }, (_, i) =>
      session(new Date(base + i * 3_600_000).toISOString())
    )
    const result = await upsertStrengthSessions(client, many)
    expect(new Set(many.map(s => s.started_at)).size).toBe(507)
    expect(calls.length).toBeGreaterThan(1)
    expect(result.upserted).toBe(507)
    // Every row makes it through the batching, none dropped at a boundary.
    expect(calls.reduce((n, c) => n + c.rows.length, 0)).toBe(507)
  })

  it('names the failing batch rather than surfacing a bare Supabase message', async () => {
    const client = {
      from() {
        return {
          upsert() {
            return Promise.resolve({ error: { message: 'permission denied' } })
          },
        }
      },
    } as unknown as SupabaseClient
    await expect(
      upsertStrengthSessions(client, [session('2019-03-04T18:00:00-07:00')])
    ).rejects.toThrow(/strength sessions.*permission denied/i)
  })
})
