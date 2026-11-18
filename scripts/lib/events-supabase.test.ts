/**
 * Tests for the events importer's matching plan (#502). `planEventLinks` is
 * pure, so these need no database. All values are synthetic.
 */
import { describe, expect, it } from 'vitest'

import { UNTITLED, planEventLinks, zoneForState } from './events-supabase.mjs'

type Kind =
  | 'purchase'
  | 'transfer_in'
  | 'transfer_out'
  | 'fulfilment'
  | 'reminder'
  | 'post_event'
  | 'notice'
  | 'unrecognized'

let seq = 0
/** A parsed email with sensible defaults; override what the case is about. */
function item(over: Record<string, unknown> & { kind?: Kind } = {}) {
  seq += 1
  return {
    messageId: `m${seq}`,
    subject: `subject ${seq}`,
    receivedAt: new Date(Date.UTC(2026, 2, 1, 0, seq)),
    parsed: {
      platform: 'gametime',
      kind: 'purchase' as Kind,
      title: 'Riverside Rockets at Harbor City Hawks',
      when: { year: 2026, month: 3, day: 14, hour: 18, minute: 40 },
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      orderRef: null,
      ticketCount: 1,
      costTotal: null,
      costCurrency: null,
      counterpart: null,
      confidence: 1,
      note: null,
      ...over,
    },
  }
}

describe('planEventLinks', () => {
  it('puts a purchase and a transfer for the same game on one new event', () => {
    const plan = planEventLinks(
      [
        item(),
        item({
          platform: 'ticketmaster',
          kind: 'transfer_in',
          title: 'Harbor City Hawks vs. Riverside Rockets',
        }),
      ],
      []
    )
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0]).toMatchObject({
      match_key: '2026-03-14|v:examplearena',
      title: 'Riverside Rockets at Harbor City Hawks',
      category: 'sports',
      teams: ['Riverside Rockets', 'Harbor City Hawks'],
      // 18:40 Pacific daylight time.
      starts_at: '2026-03-15T01:40:00.000Z',
    })
    expect(plan.emails.map(e => e.eventKey)).toEqual([
      '2026-03-14|v:examplearena',
      '2026-03-14|v:examplearena',
    ])
  })

  it('adds nothing on a re-run once the event is stored', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|v:examplearena',
      title: 'x',
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item()], [stored])
    expect(plan.inserts).toEqual([])
    expect(plan.updates).toEqual([])
    expect(plan.emails[0].eventKey).toBe(stored.match_key)
  })

  it('re-keys a title-only event when a later email names the venue, within one run', () => {
    const plan = planEventLinks([item({ venue: null, city: null, state: null }), item()], [])
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0]).toMatchObject({
      match_key: '2026-03-14|v:examplearena',
      venue: 'Example Arena',
    })
    expect(new Set(plan.emails.map(e => e.eventKey))).toEqual(
      new Set(['2026-03-14|v:examplearena'])
    )
  })

  it('re-keys a stored title-only event and fills in its venue', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|t:show',
      title: 'Show',
      venue: null,
      city: null,
      state: null,
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item()], [stored])
    expect(plan.inserts).toEqual([])
    expect(plan.updates).toEqual([
      {
        id: 'e1',
        changes: {
          match_key: '2026-03-14|v:examplearena',
          venue: 'Example Arena',
          city: 'Springfield',
          state: 'CA',
          // Recomputed in the newly known state's zone.
          starts_at: '2026-03-15T01:40:00.000Z',
        },
      },
    ])
  })

  it('moves the start into the right zone when a later email names the state', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|v:examplearena',
      title: 'x',
      venue: 'Example Arena',
      city: null,
      state: null,
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item({ city: 'Aurora', state: 'CO' })], [stored])
    expect(plan.updates).toEqual([
      {
        id: 'e1',
        // 18:40 mountain daylight time.
        changes: { city: 'Aurora', state: 'CO', starts_at: '2026-03-15T00:40:00.000Z' },
      },
    ])
  })

  it('replaces a placeholder title, with its category, when an email names the event', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|v:examplearena',
      title: UNTITLED,
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item()], [stored])
    expect(plan.updates).toEqual([
      {
        id: 'e1',
        changes: {
          title: 'Riverside Rockets at Harbor City Hawks',
          category: 'sports',
          teams: ['Riverside Rockets', 'Harbor City Hawks'],
        },
      },
    ])
    const untitled = planEventLinks([item({ title: null })], [])
    expect(untitled.inserts[0].title).toBe(UNTITLED)
  })

  it('keeps an email linked where it already is, even to another event', () => {
    const linkedItem = item()
    const plan = planEventLinks([linkedItem], [], new Map([[linkedItem.messageId, 'owner-fixed']]))
    expect(plan.inserts).toEqual([])
    expect(plan.emails[0]).toMatchObject({ eventId: 'owner-fixed', eventKey: null })
  })

  it('joins a dateless after-the-event email to the event in the days before it', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|v:examplearena',
      title: 'Night at the Example Museum',
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const other = { ...stored, id: 'e2', match_key: '2026-03-13|v:samplehall', title: 'Other' }
    const postEvent = (receivedAt: string) => ({
      ...item({ kind: 'post_event', when: null, title: 'Night at the Example Museum' }),
      receivedAt: new Date(receivedAt),
    })
    // Two recent events: the title decides.
    const plan = planEventLinks([postEvent('2026-03-15T18:00:00Z')], [stored, other])
    expect(plan.emails[0].eventKey).toBe(stored.match_key)
    // Before the event started, or past the window: no match.
    const early = planEventLinks([postEvent('2026-03-14T18:00:00Z')], [stored])
    expect(early.emails[0].eventKey).toBeNull()
    const late = planEventLinks([postEvent('2026-03-25T18:00:00Z')], [stored])
    expect(late.emails[0].eventKey).toBeNull()
  })

  it('joins a title-only email to the only event on its date', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|v:examplearena',
      title: 'x',
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item({ venue: null, title: 'Something Else' })], [stored])
    expect(plan.inserts).toEqual([])
    expect(plan.emails[0].eventKey).toBe(stored.match_key)
  })

  it('does not guess between two events on one date', () => {
    const a = {
      id: 'a',
      match_key: '2026-03-14|v:examplearena',
      title: 'A',
      venue: 'Example Arena',
      city: null,
      state: null,
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const b = {
      id: 'b',
      match_key: '2026-03-14|v:samplehall',
      title: 'B',
      venue: 'Sample Hall',
      city: null,
      state: null,
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item({ venue: null, title: 'C' })], [a, b])
    expect(plan.inserts.map(i => i.match_key)).toEqual(['2026-03-14|t:c'])
  })

  it('stores a notice, an unrecognized email and a dateless one unmatched', () => {
    const plan = planEventLinks(
      [item({ kind: 'notice' }), item({ kind: 'unrecognized' }), item({ when: null })],
      []
    )
    expect(plan.inserts).toEqual([])
    expect(plan.emails.map(e => e.eventKey)).toEqual([null, null, null])
    expect(plan.emails.map(e => e.row.gmail_message_id)).toHaveLength(3)
  })

  it('never overwrites a stored title or venue, only fills what is empty', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-03-14|v:examplearena',
      title: 'Owner Title',
      venue: 'Example Arena',
      city: null,
      state: 'CA',
      starts_at: '2026-03-15T01:40:00.000Z',
    }
    const plan = planEventLinks([item({ title: 'Email Title' })], [stored])
    expect(plan.updates).toEqual([{ id: 'e1', changes: { city: 'Springfield' } }])
  })

  it('carries every parsed field onto the email row', () => {
    const plan = planEventLinks(
      [
        item({
          orderRef: 'ZQ7TEST123',
          costTotal: 12.5,
          costCurrency: 'USD',
          counterpart: 'Jordan',
        }),
      ],
      []
    )
    expect(plan.emails[0].row).toMatchObject({
      platform: 'gametime',
      kind: 'purchase',
      order_ref: 'ZQ7TEST123',
      ticket_count: 1,
      cost_total: 12.5,
      cost_currency: 'USD',
      counterpart: 'Jordan',
      confidence: 1,
    })
  })
})

describe('zoneForState', () => {
  it('maps mountain and other non-Pacific states, and defaults to Pacific', () => {
    expect(zoneForState('CO')).toBe('America/Denver')
    expect(zoneForState('wa')).toBe('America/Los_Angeles')
    expect(zoneForState(null)).toBe('America/Los_Angeles')
  })

  it('stores a Colorado start in mountain time', () => {
    const plan = planEventLinks(
      [
        item({
          state: 'CO',
          city: 'Aurora',
          when: { year: 2026, month: 1, day: 21, hour: 19, minute: 0 },
        }),
      ],
      []
    )
    expect(plan.inserts[0].starts_at).toBe('2026-01-22T02:00:00.000Z')
  })
})
