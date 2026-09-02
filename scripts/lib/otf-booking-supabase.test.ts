/**
 * Tests for the OTF booking upsert, reconcile pass, and data-quality gates
 * (#453).
 *
 * The reconcile tests are the important ones. Its whole value is what it
 * *doesn't* write: a manual label must survive, a re-run must be a no-op, and
 * an unmatched session must stay null rather than acquire a plausible guess.
 * Those are the properties #268/#271 established and that a careless full-row
 * upsert would silently undo.
 *
 * The Supabase client is faked, so no network or credentials are needed.
 */
import { describe, expect, it } from 'vitest'

import {
  composeClassFormat,
  eventToBookingRow,
  findBookingFeedSilence,
  findMatchingBooking,
  findSessionsMissingClassFormat,
  reconcileOtfBookings,
  upsertOtfBookings,
} from './otf-booking-supabase.mjs'

/** Seeded table contents, keyed by table name. */
type Tables = Record<string, Array<Record<string, unknown>>>

/**
 * Minimal table-aware stand-in for the supabase-js client.
 *
 * Implements only the surface these paths touch: a thenable `select()` builder
 * supporting `eq`/`is`/`gte`/`order`/`range` plus PostgREST's
 * `{ count: 'exact', head: true }` mode, an `upsert()` that captures writes,
 * and `update().eq()` that applies the patch to the seeded row so
 * post-assertions see the mutation.
 */
function fakeClient(tables: Tables) {
  const upserted: Record<string, Array<Record<string, unknown>>> = {}
  const updates: Array<{ table: string; patch: Record<string, unknown>; key: unknown }> = []

  function builder(table: string, count: boolean) {
    const filters: Array<(r: Record<string, unknown>) => boolean> = []
    let slice: [number, number] | null = null
    const self = {
      eq(col: string, val: unknown) {
        filters.push(r => r[col] === val)
        return self
      },
      is(col: string, val: unknown) {
        filters.push(r => (val === null ? r[col] == null : r[col] === val))
        return self
      },
      gte(col: string, val: unknown) {
        filters.push(r => String(r[col]) >= String(val))
        return self
      },
      order() {
        return self
      },
      range(from: number, to: number) {
        slice = [from, to]
        return self
      },
      then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
        let data = (tables[table] ?? []).filter(r => filters.every(f => f(r)))
        if (count) return Promise.resolve({ count: data.length, error: null }).then(resolve, reject)
        if (slice) data = data.slice(slice[0], slice[1] + 1) // `to` is inclusive
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return self
  }

  const client = {
    from(table: string) {
      return {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) =>
          builder(table, opts?.count === 'exact'),
        upsert: async (rows: Array<Record<string, unknown>>) => {
          upserted[table] = [...(upserted[table] ?? []), ...rows]
          return { error: null }
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: unknown) => {
            const target = (tables[table] ?? []).find(r => r[col] === val)
            if (target) Object.assign(target, patch)
            updates.push({ table, patch, key: val })
            return { error: null }
          },
        }),
      }
    },
  }

  return { client: client as never, upserted, updates, tables }
}

/** A normalized calendar event, with overridable fields. */
function event(over: Partial<Record<string, unknown>> = {}) {
  return {
    externalEventId: 'evt-1',
    startsAt: '2026-08-08T16:30:00.000Z',
    endsAt: '2026-08-08T17:30:00.000Z',
    titleRaw: 'Orange 60 Min 3G',
    locationRaw: 'Marina Del Rey',
    ...over,
  } as never
}

describe('composeClassFormat', () => {
  it('prefixes the program variant so HYROX 2G is distinguishable from 2G', () => {
    // Storing a bare '2G' would render the HYROX class identically to an
    // ordinary 2G and put both under one filter chip — template mixing under a
    // single label, which is the defect #453 exists to remove.
    expect(composeClassFormat('HYROX', '2G')).toBe('HYROX 2G')
  })

  it('leaves a plain template alone', () => {
    expect(composeClassFormat(null, '3G')).toBe('3G')
  })

  it('stays null when the title never parsed', () => {
    expect(composeClassFormat('HYROX', null)).toBeNull()
    expect(composeClassFormat(null, null)).toBeNull()
  })
})

describe('eventToBookingRow', () => {
  it('maps and parses a well-formed event', () => {
    expect(eventToBookingRow(event())).toMatchObject({
      external_event_id: 'evt-1',
      starts_at: '2026-08-08T16:30:00.000Z',
      ends_at: '2026-08-08T17:30:00.000Z',
      title_raw: 'Orange 60 Min 3G',
      studio_raw: 'Marina Del Rey',
      studio: 'Marina Del Rey',
      program: null,
      duration_min: 60,
      format: '3G',
    })
  })

  it('folds the program into the stored format', () => {
    expect(eventToBookingRow(event({ titleRaw: 'Orange HYROX 60 Min 2G' }))).toMatchObject({
      program: 'HYROX',
      format: 'HYROX 2G',
    })
  })

  it('stamps last_seen_at so the feed has a liveness signal', () => {
    // ingested_at records only the first sighting, so it cannot answer "is the
    // feed still producing?" — see findBookingFeedSilence.
    expect(typeof eventToBookingRow(event()).last_seen_at).toBe('string')
  })

  it('keeps title_raw when the grammar fails, leaving parsed columns null', () => {
    // Never drop the row and never guess: the booking existed even if we can't
    // name its template, and title_raw is the evidence for a later re-parse.
    const row = eventToBookingRow(event({ titleRaw: 'Orange something new' }))
    expect(row).toMatchObject({
      title_raw: 'Orange something new',
      format: null,
      duration_min: null,
      program: null,
    })
  })
})

describe('upsertOtfBookings', () => {
  it('writes OTF bookings and ignores unrelated calendar events', async () => {
    const { client, upserted } = fakeClient({ otf_bookings: [] })
    const result = await upsertOtfBookings(client, [
      event({ externalEventId: 'a' }),
      event({ externalEventId: 'b', titleRaw: 'Dentist appointment' }),
    ])
    expect(result).toMatchObject({ written: 1, notOtf: 1 })
    expect(upserted.otf_bookings.map(r => r.external_event_id)).toEqual(['a'])
  })

  it('dedupes repeated UIDs within one batch', async () => {
    // Postgres rejects an upsert whose payload conflicts with itself.
    const { client, upserted } = fakeClient({ otf_bookings: [] })
    await upsertOtfBookings(client, [
      event({ externalEventId: 'dup' }),
      event({ externalEventId: 'dup' }),
    ])
    expect(upserted.otf_bookings).toHaveLength(1)
  })

  it('surfaces titles it stored but could not parse', async () => {
    const { client } = fakeClient({ otf_bookings: [] })
    const result = await upsertOtfBookings(client, [event({ titleRaw: 'Orange mystery class' })])
    expect(result.written).toBe(1)
    expect(result.unparsedTitles).toEqual(['Orange mystery class'])
  })
})

describe('findMatchingBooking', () => {
  const bookings = [
    { id: 'b1', starts_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey', format: '3G' },
    { id: 'b2', starts_at: '2026-08-08T16:30:00.000Z', studio: 'Mar Vista', format: 'Tread 50' },
  ]
  const tolerance = 15 * 60_000

  it('matches on time and studio together', () => {
    const session = { started_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey, CA' }
    expect(findMatchingBooking(session, bookings, tolerance)?.id).toBe('b1')
  })

  it('matches inside the tolerance window', () => {
    const session = { started_at: '2026-08-08T16:40:00.000Z', studio: 'Marina Del Rey, CA' }
    expect(findMatchingBooking(session, bookings, tolerance)?.id).toBe('b1')
  })

  it('does not match outside the tolerance window', () => {
    const session = { started_at: '2026-08-08T17:00:00.000Z', studio: 'Marina Del Rey, CA' }
    expect(findMatchingBooking(session, bookings, tolerance)).toBeNull()
  })

  it('never crosses studios, even at an identical start time', () => {
    // Two studios can run a class at the same clock time; this is why studio is
    // part of the join key rather than an afterthought.
    const session = { started_at: '2026-08-08T16:30:00.000Z', studio: 'Playa Vista, CA' }
    expect(findMatchingBooking(session, bookings, tolerance)).toBeNull()
  })

  it('matches nothing when the session has no studio', () => {
    const session = { started_at: '2026-08-08T16:30:00.000Z', studio: null }
    expect(findMatchingBooking(session, bookings, tolerance)).toBeNull()
  })

  it('picks the nearest booking when several fall inside the window', () => {
    const crowded = [
      { id: 'far', starts_at: '2026-08-08T16:40:00.000Z', studio: 'Marina Del Rey', format: '2G' },
      { id: 'near', starts_at: '2026-08-08T16:31:00.000Z', studio: 'Marina Del Rey', format: '3G' },
    ]
    const session = { started_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey' }
    expect(findMatchingBooking(session, crowded, tolerance)?.id).toBe('near')
  })
})

/** Seed one booking and one session at the same instant and studio. */
function seedMatched(sessionOver: Record<string, unknown> = {}) {
  return fakeClient({
    otf_bookings: [
      { id: 'b1', starts_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey', format: '3G' },
    ],
    otf_sessions: [
      {
        started_at: '2026-08-08T16:30:00.000Z',
        studio: 'Marina Del Rey, CA',
        booking_id: null,
        class_format: null,
        class_format_source: null,
        excluded: false,
        ...sessionOver,
      },
    ],
  })
}

describe('reconcileOtfBookings', () => {
  it('links a session to its booking and resolves the format', async () => {
    const { client, tables } = seedMatched()
    const result = await reconcileOtfBookings(client)
    expect(result).toMatchObject({ linked: 1, formatted: 1, unmatched: 0 })
    expect(tables.otf_sessions[0]).toMatchObject({
      booking_id: 'b1',
      class_format: '3G',
      class_format_source: 'booking',
    })
  })

  it('never overwrites a manual label', async () => {
    // A hand-entered label for a drop-in outranks anything this pass infers.
    const { client, tables, updates } = seedMatched({
      class_format: 'Tread 50',
      class_format_source: 'manual',
    })
    const result = await reconcileOtfBookings(client)
    expect(result.manual).toBe(1)
    expect(updates).toHaveLength(0)
    expect(tables.otf_sessions[0].class_format).toBe('Tread 50')
  })

  it('is idempotent — a second run writes nothing', async () => {
    const { client, updates } = seedMatched()
    await reconcileOtfBookings(client)
    const writesAfterFirst = updates.length
    const second = await reconcileOtfBookings(client)
    expect(updates).toHaveLength(writesAfterFirst)
    expect(second).toMatchObject({ linked: 0, formatted: 0 })
  })

  it('leaves an unmatched session null and counts it', async () => {
    // ~9% of sessions are drop-ins with no booking. Null is the correct
    // outcome; a guess here is the exact failure this feature removes.
    const { client, tables } = fakeClient({
      otf_bookings: [],
      otf_sessions: [
        {
          started_at: '2026-08-07T02:00:00.000Z',
          studio: 'Mar Vista, CA',
          booking_id: null,
          class_format: null,
          class_format_source: null,
          excluded: false,
        },
      ],
    })
    const result = await reconcileOtfBookings(client)
    expect(result).toMatchObject({ linked: 0, formatted: 0, unmatched: 1 })
    expect(tables.otf_sessions[0].class_format).toBeNull()
  })

  it('links a booking whose title never parsed, without inventing a format', async () => {
    const { client, tables } = fakeClient({
      otf_bookings: [
        { id: 'b1', starts_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey', format: null },
      ],
      otf_sessions: [
        {
          started_at: '2026-08-08T16:30:00.000Z',
          studio: 'Marina Del Rey, CA',
          booking_id: null,
          class_format: null,
          class_format_source: null,
          excluded: false,
        },
      ],
    })
    const result = await reconcileOtfBookings(client)
    expect(result).toMatchObject({ linked: 1, formatted: 0 })
    expect(tables.otf_sessions[0]).toMatchObject({ booking_id: 'b1', class_format: null })
  })

  it('re-syncs a booking-sourced format when the calendar title is corrected', async () => {
    // upsertOtfBookings deliberately refreshes otf_bookings.format every run,
    // so a write-once guard here would let the two tables disagree forever:
    // the chip would keep showing '3G' with a tooltip claiming the booking
    // says so, long after the booking said '2G'.
    const { client, tables } = fakeClient({
      otf_bookings: [
        { id: 'b1', starts_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey', format: '2G' },
      ],
      otf_sessions: [
        {
          started_at: '2026-08-08T16:30:00.000Z',
          studio: 'Marina Del Rey, CA',
          booking_id: 'b1',
          class_format: '3G',
          class_format_source: 'booking',
          excluded: false,
        },
      ],
    })
    const result = await reconcileOtfBookings(client)
    expect(result.formatted).toBe(1)
    expect(tables.otf_sessions[0].class_format).toBe('2G')
  })

  it('does not re-sync over a manual label even when a booking matches', async () => {
    const { client, tables, updates } = seedMatched({
      booking_id: 'b1',
      class_format: 'Tread 50',
      class_format_source: 'manual',
    })
    await reconcileOtfBookings(client)
    expect(updates).toHaveLength(0)
    expect(tables.otf_sessions[0].class_format).toBe('Tread 50')
  })

  it('self-heals a linked session once its booking acquires a format', async () => {
    // Append-only writes alone cannot self-heal — that is what left three
    // sessions with a null class_type for 20 days (#334).
    const { client, tables } = fakeClient({
      otf_bookings: [
        { id: 'b1', starts_at: '2026-08-08T16:30:00.000Z', studio: 'Marina Del Rey', format: '3G' },
      ],
      otf_sessions: [
        {
          started_at: '2026-08-08T16:30:00.000Z',
          studio: 'Marina Del Rey, CA',
          booking_id: 'b1',
          class_format: null,
          class_format_source: null,
          excluded: false,
        },
      ],
    })
    const result = await reconcileOtfBookings(client)
    expect(result).toMatchObject({ linked: 0, formatted: 1 })
    expect(tables.otf_sessions[0].class_format).toBe('3G')
  })
})

describe('findSessionsMissingClassFormat', () => {
  it('lists counted sessions with no class_format and skips excluded ones', async () => {
    // An excluded belt-malfunction row legitimately has no format.
    const { client } = fakeClient({
      otf_sessions: [
        {
          started_at: '2026-08-07T02:00:00.000Z',
          studio: 'Mar Vista, CA',
          class_format: null,
          excluded: false,
        },
        {
          started_at: '2026-05-30T02:00:00.000Z',
          studio: 'Marina Del Rey, CA',
          class_format: null,
          excluded: true,
        },
        {
          started_at: '2026-08-08T16:30:00.000Z',
          studio: 'Marina Del Rey, CA',
          class_format: '3G',
          excluded: false,
        },
      ],
    })
    const missing = await findSessionsMissingClassFormat(client)
    expect(missing.map(s => s.started_at)).toEqual(['2026-08-07T02:00:00.000Z'])
  })
})

describe('findBookingFeedSilence', () => {
  const now = new Date('2026-08-12T00:00:00.000Z')

  it('flags sessions arriving with no bookings at all', async () => {
    // The revoked-app-password case: CalDAV breaks, the email pull keeps
    // working, and class_format quietly stops being populated.
    const { client } = fakeClient({
      otf_sessions: [{ started_at: '2026-08-11T01:45:00.000Z' }],
      otf_bookings: [],
    })
    const result = await findBookingFeedSilence(client, { now })
    expect(result).toMatchObject({ silent: true, sessionCount: 1, bookingCount: 0 })
  })

  it('stays quiet when bookings are still being seen', async () => {
    const { client } = fakeClient({
      otf_sessions: [{ started_at: '2026-08-11T01:45:00.000Z' }],
      otf_bookings: [{ id: 'b1', last_seen_at: '2026-08-11T08:00:00.000Z' }],
    })
    expect((await findBookingFeedSilence(client, { now })).silent).toBe(false)
  })

  it('still fires when the only bookings are future ones stored before the feed died', async () => {
    // The motivating case: a password reset revokes the app-specific password
    // the day after a healthy pull banked the next month of classes. Counting
    // by class time, those future rows keep the gate green through exactly the
    // window it exists to cover.
    const { client } = fakeClient({
      otf_sessions: [{ started_at: '2026-08-11T01:45:00.000Z' }],
      otf_bookings: [
        {
          id: 'b1',
          starts_at: '2026-09-01T16:30:00.000Z',
          last_seen_at: '2026-06-01T08:00:00.000Z',
        },
      ],
    })
    const result = await findBookingFeedSilence(client, { now })
    expect(result).toMatchObject({ silent: true, bookingCount: 0 })
  })

  it('stays quiet when there were simply no classes', async () => {
    // A quiet fortnight is not a broken feed. Cross-referencing against
    // sessions is the whole point — the booking count alone cannot tell these
    // two apart, and a gate that fires on a holiday gets ignored.
    const { client } = fakeClient({ otf_sessions: [], otf_bookings: [] })
    expect((await findBookingFeedSilence(client, { now })).silent).toBe(false)
  })

  it('ignores rows outside the window', async () => {
    const { client } = fakeClient({
      otf_sessions: [{ started_at: '2026-06-01T01:45:00.000Z' }],
      otf_bookings: [],
    })
    expect((await findBookingFeedSilence(client, { now })).silent).toBe(false)
  })
})
