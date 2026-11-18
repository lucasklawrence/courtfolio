/**
 * Tests for the events importer's matching plan (#502). `planEventLinks` is
 * pure, so these need no database. All values are synthetic.
 */
import { describe, expect, it } from 'vitest'

import { planEventLinks, zoneForState } from './events-supabase.mjs'

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
    receivedAt: new Date(Date.UTC(2026, 9, 1, 0, seq)),
    parsed: {
      platform: 'gametime',
      kind: 'purchase' as Kind,
      title: 'Riverside Rockets at Harbor City Hawks',
      when: { year: 2026, month: 10, day: 12, hour: 17, minute: 15 },
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
      match_key: '2026-10-12|v:examplearena',
      title: 'Riverside Rockets at Harbor City Hawks',
      category: 'sports',
      teams: ['Riverside Rockets', 'Harbor City Hawks'],
      // 17:15 Pacific daylight time.
      starts_at: '2026-10-13T00:15:00.000Z',
    })
    expect(plan.emails.map(e => e.eventKey)).toEqual([
      '2026-10-12|v:examplearena',
      '2026-10-12|v:examplearena',
    ])
  })

  it('adds nothing on a re-run once the event is stored', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-10-12|v:examplearena',
      title: 'x',
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
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
      match_key: '2026-10-12|v:examplearena',
      venue: 'Example Arena',
    })
    expect(new Set(plan.emails.map(e => e.eventKey))).toEqual(
      new Set(['2026-10-12|v:examplearena'])
    )
  })

  it('re-keys a stored title-only event and fills in its venue', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-10-12|t:show',
      title: 'Show',
      venue: null,
      city: null,
      state: null,
    }
    const plan = planEventLinks([item()], [stored])
    expect(plan.inserts).toEqual([])
    expect(plan.updates).toEqual([
      {
        id: 'e1',
        changes: {
          match_key: '2026-10-12|v:examplearena',
          venue: 'Example Arena',
          city: 'Springfield',
          state: 'CA',
        },
      },
    ])
  })

  it('joins a title-only email to the only event on its date', () => {
    const stored = {
      id: 'e1',
      match_key: '2026-10-12|v:examplearena',
      title: 'x',
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
    }
    const plan = planEventLinks([item({ venue: null, title: 'Something Else' })], [stored])
    expect(plan.inserts).toEqual([])
    expect(plan.emails[0].eventKey).toBe(stored.match_key)
  })

  it('does not guess between two events on one date', () => {
    const a = {
      id: 'a',
      match_key: '2026-10-12|v:examplearena',
      title: 'A',
      venue: 'Example Arena',
      city: null,
      state: null,
    }
    const b = {
      id: 'b',
      match_key: '2026-10-12|v:samplehall',
      title: 'B',
      venue: 'Sample Hall',
      city: null,
      state: null,
    }
    const plan = planEventLinks([item({ venue: null, title: 'C' })], [a, b])
    expect(plan.inserts.map(i => i.match_key)).toEqual(['2026-10-12|t:c'])
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
      match_key: '2026-10-12|v:examplearena',
      title: 'Owner Title',
      venue: 'Example Arena',
      city: null,
      state: 'CA',
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

  it('stores a Denver start in Denver time', () => {
    const plan = planEventLinks(
      [
        item({
          state: 'CO',
          city: 'Denver',
          when: { year: 2026, month: 2, day: 4, hour: 19, minute: 0 },
        }),
      ],
      []
    )
    expect(plan.inserts[0].starts_at).toBe('2026-02-05T02:00:00.000Z')
  })
})
