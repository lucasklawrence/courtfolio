/**
 * Tests for the ticket-email parser.
 *
 * Every fixture is SYNTHETIC: this repo is public, so no real email, event,
 * venue, person or amount is committed. Each one copies the block structure a
 * real email of that layout has (which cells hold the title, date, venue and
 * city, and what sits between them), with every value invented. The layouts
 * were read from real mail when the parser was written; the values were not
 * kept.
 */
import { describe, expect, it } from 'vitest'

// Imported from the plain-`node` .mjs so the test pins the exact module the
// import script runs.
import {
  PLATFORMS,
  classifyEmail,
  cleanEmailText,
  eventMatchKey,
  findEventDates,
  findVenue,
  inferCategory,
  normalizeForMatch,
  parseEventEmail,
  platformForSender,
  platformQuery,
  resolveEventDate,
} from './events-parser.mjs'

const td = (s: string) => `<td>${s}</td>`
const row = (...cells: string[]) => `<tr>${cells.map(td).join('')}</tr>`
const html = (...rows: string[]) =>
  `<html><head><style>.x{color:red}</style><title>Mail</title></head><body><table>${rows.join('')}</table></body></html>`

/** Gametime order receipt: venue and city in separate cells, no year in the date. */
const GAMETIME_ORDER = html(
  row('Boom. Order Received.'),
  row('Order Details Order #'),
  row('ZQ7TEST123'),
  row('Riverside Rockets at Harbor City Hawks'),
  row('Saturday, March 14, 6:40pm'),
  row('Example Arena'),
  row('Springfield,'),
  row('CA'),
  row('Disclosures'),
  row('2'),
  row('Tickets'),
  row('Ticket Price'),
  row('Total Paid $123.45 x 1')
)

/** Ticketmaster transfer: a deadline date first, then the event card twice (phone and desktop). */
const TM_TRANSFER_IN = html(
  row('First step, accept your tickets. &#847;&#8199;&#65279;&#847;&#8199;&#65279;'),
  row('Jordan just sent you 2 Harbor City Hawks tickets.'),
  row('Accept by Thu &bull; Sep 3, 2026 &bull; 09:00 PM'),
  row('Transferred Tickets (2)'),
  row('Harbor City Hawks vs Riverside Rockets'),
  row('Thu &bull; Sep 3, 2026 &bull; 07:00 PM'),
  row('Thu &bull; Sep 3, 2026 &bull; 07:00 PM'),
  row('Example Arena | Springfield, CA'),
  row('Sec 101, Row 7, Seat 1'),
  row('Sec 101, Row 7, Seat 2'),
  row('Sec 101, Row 7, Seat 1')
)

/** Ticketmaster purchase, current layout: "Venue - City, ST", "2x", "Total $". */
const TM_PURCHASE = html(
  row('You Got the Tickets'),
  row('ORDER # 9-99999/ABC'),
  row('An Evening of Examples'),
  row('Fri &middot; Feb 12, 2027 &middot; 7:00 PM'),
  row('Sample Hall - Lakeside, CA'),
  row('Order Summary Your Tickets 2x Standard Admission'),
  row('Payment Summary Total $80.10')
)

/** Eventbrite order: calendar links, then venue, street and "City, ST zip" in their own blocks. */
const EVENTBRITE_ORDER = html(
  row('Your Tickets for Night at the Example Museum'),
  row('Night at the Example Museum 1 x Ticket Order total: 42.00 USD'),
  row('Wednesday, November 18, 2026 from 7:00 PM to 10:00 PM (PT)'),
  row('Add to Google &middot; Outlook &middot; iCal &middot; Yahoo'),
  row('Example Museum'),
  row('100 Sample Street'),
  row('Harborview, WA 98000'),
  row('Order Summary Order #12345678901 - November 2, 2026')
)

const AUG_2026 = new Date('2026-08-01T18:00:00Z')
const MAR_2026 = new Date('2026-03-14T00:28:00Z')

describe('cleanEmailText', () => {
  it('keeps block boundaries, decodes entities and drops head, style and preheader padding', () => {
    const text = cleanEmailText(
      html(row('A &amp; B &mdash; C&#8199;&#847;'), row('Fri &bull; Jun&nbsp;5')) +
        '<!-- hidden -->'
    )
    expect(text).toBe('¶ A & B — C ¶ Fri • Jun 5 ¶')
    expect(text).not.toMatch(/color|Mail|hidden/)
  })

  it('collapses runs of empty blocks into one separator', () => {
    expect(cleanEmailText('<div><p></p><br><br>x</div>')).toBe('¶ x ¶')
  })
})

describe('platformForSender / classifyEmail', () => {
  it('knows the transactional senders and places a same-domain sender by domain', () => {
    expect(platformForSender('Gametime <receipts@e.gametime.co>')?.id).toBe('gametime')
    expect(platformForSender('newsletter@email.ticketmaster.com')?.id).toBe('ticketmaster')
    expect(platformForSender('someone@example.com')).toBeNull()
  })

  it('classifies by subject, first rule wins, and falls back to unrecognized', () => {
    const tm = PLATFORMS.find(p => p.id === 'ticketmaster')!
    expect(classifyEmail(tm, 'You Got Tickets To An Evening')).toBe('purchase')
    expect(classifyEmail(tm, "You've assigned Pat a ticket")).toBe('transfer_out')
    expect(classifyEmail(tm, 'Jordan Just Sent You 2 Hawks Ticket(s)')).toBe('transfer_in')
    expect(classifyEmail(tm, "You're all set to see Hawks vs. Rockets")).toBe('transfer_in')
    // classifyEmail sees the raw subject; parseEventEmail straightens it first.
    expect(
      parseEventEmail({
        from: 'customer_support@email.ticketmaster.com',
        subject: 'You’ve assigned Pat a ticket',
        html: html(row('You’re all set')),
        receivedAt: MAR_2026,
      })
    ).toMatchObject({ kind: 'transfer_out', counterpart: 'Pat' })
    expect(cleanEmailText('<p>You’re</p>')).toBe("¶ You're ¶")
    expect(classifyEmail(tm, 'Event Reminder: Hawks vs. Rockets')).toBe('reminder')
    expect(classifyEmail(tm, 'Your Weekly Picks')).toBe('unrecognized')
  })

  it('reads every transfer wording seen, both directions', () => {
    const tm = PLATFORMS.find(p => p.id === 'ticketmaster')!
    for (const subject of [
      'Jordan Lee has transferred you ticket(s) for Harbor City Hawks vs. Riverside Rockets',
      'Jordan transferred you 2 tickets',
      "You've received tickets from Jordan",
      'Your Ticket Transfer From Jordan Is Ready To Be Accepted',
    ]) {
      expect(classifyEmail(tm, subject), subject).toBe('transfer_in')
    }
    for (const subject of [
      'Your Ticket Has Been Accepted by Pat',
      'Your ticket has been accepted by Pat Kim for Harbor City Hawks vs. Riverside Rockets',
      'Your Ticket Transfer Went Through',
    ]) {
      expect(classifyEmail(tm, subject), subject).toBe('transfer_out')
    }
  })

  it('files account mail as a notice on every platform, so it stays off the review list', () => {
    for (const p of PLATFORMS) {
      expect(classifyEmail(p, 'Your password has been updated')).toBe('notice')
      expect(classifyEmail(p, 'Your authentication code')).toBe('notice')
    }
    // An event whose title happens to hold an account word is still an event.
    const eb = PLATFORMS.find(p => p.id === 'eventbrite')!
    expect(classifyEmail(eb, 'Order confirmation for Password Security Workshop')).toBe('purchase')
  })

  it('reads a Gametime "Order Confirmation - <Event> @ <Venue>" subject as a purchase', () => {
    const gt = PLATFORMS.find(p => p.id === 'gametime')!
    expect(classifyEmail(gt, 'Order Confirmation - Rockets @ Hawks @ Example Arena on 3/14')).toBe(
      'purchase'
    )
    // With no order block in the body, the title comes from the subject, venue dropped.
    const p = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Order Confirmation - Rockets @ Hawks @ Example Arena on 3/14',
      html: html(row('Thanks for your order')),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({ kind: 'purchase', title: 'Rockets @ Hawks' })
    // A single "@" is the matchup, not a venue.
    const single = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Order Confirmation - Rockets @ Hawks on 3/14',
      html: html(row('Thanks for your order')),
      receivedAt: MAR_2026,
    })
    expect(single?.title).toBe('Rockets @ Hawks')
  })

  it('builds one query per platform over its senders and extra clause', () => {
    const tm = PLATFORMS.find(p => p.id === 'ticketmaster')!
    expect(platformQuery(tm, 14)).toBe(
      '(from:customer_support@email.ticketmaster.com OR from:noreply@ticketmaster.com OR ' +
        '(from:newsletter@email.ticketmaster.com subject:"Event Reminder")) newer_than:14d'
    )
  })
})

describe('dates', () => {
  it('skips an "Accept by" deadline and finds every copy of the event date', () => {
    const dates = findEventDates(cleanEmailText(TM_TRANSFER_IN))
    expect(dates.map(d => d.when)).toEqual([
      { year: 2026, month: 9, day: 3, hour: 19, minute: 0 },
      { year: 2026, month: 9, day: 3, hour: 19, minute: 0 },
    ])
  })

  it('skips a deadline whose date sits in the next cell or after a colon', () => {
    const event = 'Thu &bull; Sep 10, 2026 &bull; 07:00 PM'
    for (const deadline of [
      [row('Accept by'), row('Thu &bull; Sep 3, 2026 &bull; 09:00 PM')],
      [row('Accept by: Thu &bull; Sep 3, 2026 &bull; 09:00 PM')],
    ]) {
      const dates = findEventDates(cleanEmailText(html(...deadline, row(event))))
      expect(dates.map(d => d.when.day)).toEqual([10])
    }
  })

  it('reads the "@" layout and a "from" time', () => {
    expect(findEventDates('Sat, Mar 14 @ 6:40 PM')[0].when).toEqual({
      year: null,
      month: 3,
      day: 14,
      hour: 18,
      minute: 40,
    })
    expect(findEventDates('Wednesday, November 18, 2026 from 7:00 PM')[0].when.hour).toBe(19)
  })

  it('gives a yearless date the next occurrence on or after the email', () => {
    const when = { year: null, month: 1, day: 5, hour: 19, minute: 0 }
    expect(resolveEventDate(when, new Date('2026-12-20T00:00:00Z')).year).toBe(2027)
    expect(
      resolveEventDate({ ...when, month: 12, day: 30 }, new Date('2026-12-20T00:00:00Z')).year
    ).toBe(2026)
    // A same-day purchase can land after a late start in UTC: still that day's event.
    expect(
      resolveEventDate({ ...when, month: 3, day: 14 }, new Date('2026-03-15T03:00:00Z')).year
    ).toBe(2026)
  })
})

describe('parseEventEmail', () => {
  it('reads a Gametime order: order, title, yearless date, venue split from city, tickets and cost', () => {
    const p = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Your Ticket Order - Rockets @ Hawks on 3/14',
      html: GAMETIME_ORDER,
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({
      platform: 'gametime',
      kind: 'purchase',
      orderRef: 'ZQ7TEST123',
      title: 'Riverside Rockets at Harbor City Hawks',
      when: { year: 2026, month: 3, day: 14, hour: 18, minute: 40 },
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      ticketCount: 2,
      costTotal: 123.45,
      costCurrency: 'USD',
      confidence: 1,
      note: null,
    })
  })

  it('reads a Gametime delivery notice as fulfilment and never counts its price as a cost', () => {
    const p = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject:
        'Action Required: Your Ticket Transfer - Riverside Rockets at Harbor City Hawks on 3/14',
      html: GAMETIME_ORDER,
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({
      kind: 'fulfilment',
      orderRef: 'ZQ7TEST123',
      costTotal: null,
      costCurrency: null,
    })
  })

  it('stores a failed-fulfilment notice without reading event details from it', () => {
    const p = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Action needed: replacement options for your Hawks tickets',
      html: html(row("We're sorry, your tickets for X on Friday, March 13 couldn't be fulfilled")),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({ kind: 'notice', when: null, confidence: 0 })
  })

  it('reads a Ticketmaster transfer: the event card after the deadline, the sender, two tickets', () => {
    const p = parseEventEmail({
      from: 'noreply@ticketmaster.com',
      subject: 'Jordan Just Sent You 2 Harbor City Hawks Tickets',
      html: TM_TRANSFER_IN,
      receivedAt: AUG_2026,
    })
    expect(p).toMatchObject({
      kind: 'transfer_in',
      title: 'Harbor City Hawks vs Riverside Rockets',
      when: { year: 2026, month: 9, day: 3, hour: 19, minute: 0 },
      venue: 'Example Arena',
      city: 'Springfield',
      state: 'CA',
      ticketCount: 2,
      counterpart: 'Jordan',
      costTotal: null,
    })
  })

  it('leaves the sender null when Ticketmaster hides it behind "-"', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: '- sent you ticket(s) for Harbor City Hawks vs. Riverside Rockets',
      html: html(
        row('Your Ticket Transfer From - Is Ready To Be Accepted!'),
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM'),
        row('Example Arena, Springfield, CA'),
        row('You got 1 ticket(s)!')
      ),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({
      counterpart: null,
      ticketCount: 1,
      title: 'Harbor City Hawks vs. Riverside Rockets',
      when: { year: 2026, month: 3, day: 14 },
      venue: 'Example Arena',
    })
  })

  it('reads a Ticketmaster purchase in both layouts, spelled-out states included', () => {
    const current = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: 'You got tickets to An Evening of Examples',
      html: TM_PURCHASE,
      receivedAt: new Date('2026-11-05T03:00:00Z'),
    })
    expect(current).toMatchObject({
      orderRef: '9-99999/ABC',
      title: 'An Evening of Examples',
      when: { year: 2027, month: 2, day: 12, hour: 19 },
      venue: 'Sample Hall',
      city: 'Lakeside',
      state: 'CA',
      ticketCount: 2,
      costTotal: 80.1,
    })
    const older = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: 'You Got Tickets To Open Practice',
      html: html(
        row('Order Confirmed Order # 1-23456/XYZ'),
        row('Open Practice'),
        row('Sat &middot; Jun 6, 2026 &middot; 11:00 AM'),
        row('The Field &mdash; Bayside, California'),
        row('Payment Summary Total: $0.00')
      ),
      receivedAt: new Date('2026-05-20T17:00:00Z'),
    })
    expect(older).toMatchObject({ venue: 'The Field', city: 'Bayside', state: 'CA', costTotal: 0 })
  })

  it('reads a Ticketmaster transfer out: the recipient and one ticket', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: "You've assigned Pat a ticket",
      html: html(
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM'),
        row('Example Arena, Springfield, CA')
      ),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({ kind: 'transfer_out', counterpart: 'Pat', ticketCount: 1 })
  })

  it('reads an Eventbrite order: venue after the calendar links, "City, ST zip", cost in its currency', () => {
    const p = parseEventEmail({
      from: 'Eventbrite <noreply@order.eventbrite.com>',
      subject: 'Order Confirmation for Night at the Example Museum',
      html: EVENTBRITE_ORDER,
      receivedAt: new Date('2026-11-02T00:54:00Z'),
    })
    expect(p).toMatchObject({
      kind: 'purchase',
      title: 'Night at the Example Museum',
      when: { year: 2026, month: 11, day: 18, hour: 19 },
      venue: 'Example Museum',
      city: 'Harborview',
      state: 'WA',
      orderRef: '12345678901',
      ticketCount: 1,
      costTotal: 42,
      costCurrency: 'USD',
      confidence: 1,
    })
  })

  it('reads an Eventbrite "How was it?" as an attendance signal, confident without a date', () => {
    const p = parseEventEmail({
      from: 'noreply@event.eventbrite.com',
      subject: 'How was Night at the Example Museum?',
      html: html(row('Tell us how it went')),
      receivedAt: new Date('2026-11-19T18:00:00Z'),
    })
    // It never carries a date; a matched one must not sit on the review list.
    expect(p).toMatchObject({
      kind: 'post_event',
      title: 'Night at the Example Museum',
      when: null,
      confidence: 1,
      note: null,
    })
  })

  it('reads two-word state names and hyphenated cities', () => {
    expect(findVenue(' ¶ Example Arena, Harborview, Rhode Island ¶')).toEqual({
      venue: 'Example Arena',
      city: 'Harborview',
      state: 'RI',
    })
    expect(findVenue(' ¶ Example Arena - Lake-Side, NC ¶')).toEqual({
      venue: 'Example Arena',
      city: 'Lake-Side',
      state: 'NC',
    })
    expect(findVenue(' ¶ Sample Hall, Springfield, District of Columbia ¶').state).toBe('DC')
  })

  it('returns null for a sender outside the platforms, and an unrecognized row for an unmatched subject', () => {
    expect(
      parseEventEmail({ from: 'a@example.com', subject: 'x', html: '', receivedAt: MAR_2026 })
    ).toBeNull()
    expect(
      parseEventEmail({
        from: 'noreply@ticketmaster.com',
        subject: 'Your weekly picks',
        html: '',
        receivedAt: MAR_2026,
      })
    ).toMatchObject({ kind: 'unrecognized', confidence: 0, note: 'no subject rule matched' })
  })

  it('reads a "has transferred you" email: the sender, the title and the count', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject:
        'Jordan Lee has transferred you ticket(s) for Harbor City Hawks vs. Riverside Rockets',
      html: html(
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM'),
        row('Example Arena, Springfield, CA'),
        row('Jordan Lee has transferred you 2 tickets.')
      ),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({
      kind: 'transfer_in',
      counterpart: 'Jordan Lee',
      title: 'Harbor City Hawks vs. Riverside Rockets',
      ticketCount: 2,
      venue: 'Example Arena',
    })
  })

  it('reads the recipient of a transfer-accepted notice', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject:
        'Your ticket has been accepted by Pat Kim for Harbor City Hawks vs. Riverside Rockets',
      html: html(
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM'),
        row('Example Arena, Springfield, CA')
      ),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({ kind: 'transfer_out', counterpart: 'Pat Kim' })
  })

  it('anchors a body sender name to its own sentence, whatever precedes it', () => {
    const read = (greeting: string[]) =>
      parseEventEmail({
        from: 'noreply@ticketmaster.com',
        // The subject names nobody, so the body is read.
        subject: "You've received tickets from a friend",
        html: html(
          ...greeting.map(g => row(g)),
          row('Harbor City Hawks vs Riverside Rockets'),
          row('Thu &bull; Sep 3, 2026 &bull; 07:00 PM')
        ),
        receivedAt: AUG_2026,
      })?.counterpart
    expect(read(['Hi Sam,', 'Great news! Jordan just sent you tickets.'])).toBe('Jordan')
    expect(read(['Hi Sam, Jordan just sent you tickets.'])).toBe('Jordan')
    expect(read(['Hello again. Jordan just sent you tickets.'])).toBe('Jordan')
    expect(read(['Hey there Jordan just sent you tickets.'])).toBe('Jordan')
    expect(read(['Exciting news for this weekend Jordan Lee has transferred you 2 tickets'])).toBe(
      'Jordan Lee'
    )
  })

  it('reads the same full recipient name from the subject and from the body', () => {
    const read = (subject: string, body: string) =>
      parseEventEmail({
        from: 'customer_support@email.ticketmaster.com',
        subject,
        html: html(
          row(body),
          row('Harbor City Hawks vs. Riverside Rockets'),
          row('Sat, Mar 14 @ 6:40 PM')
        ),
        receivedAt: MAR_2026,
      })?.counterpart
    // One hand-off's emails must share a counterpart, or the view counts them twice.
    expect(
      read("You've transferred your tickets", 'You transferred 2 tickets to Pat Alex Kim.')
    ).toBe('Pat Alex Kim')
    expect(read('Your tickets have been accepted by Pat Alex Kim for Hawks', 'All done')).toBe(
      'Pat Alex Kim'
    )
  })

  it('never reads "Go to My Account" as a transfer recipient', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: "You've transferred your tickets",
      html: html(
        row('Your tickets were transferred. Go to My Account to see them.'),
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM')
      ),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({ kind: 'transfer_out', counterpart: null })
  })

  it('sums several Ticketmaster ticket types once each, and ignores promo multipliers', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: 'You got tickets to An Evening of Examples',
      html: html(
        row('Earn 3x Points on your next order'),
        row('ORDER # 9-99999/ABC'),
        row('An Evening of Examples'),
        row('Fri &middot; Feb 12, 2027 &middot; 7:00 PM'),
        row('Sample Hall - Lakeside, CA'),
        row('Order Summary Your Tickets'),
        row('2x Standard Admission'),
        row('1x Accessible Seating'),
        // The desktop copy of the same summary.
        row('2x Standard Admission'),
        row('1x Accessible Seating'),
        row('Payment Summary Total $120.00'),
        row('Earn 5x Points when you pay with the card')
      ),
      receivedAt: new Date('2026-11-05T03:00:00Z'),
    })
    expect(p?.ticketCount).toBe(3)
    const promoOnly = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: 'You got tickets to An Evening of Examples',
      html: html(
        row('Earn 2x Points with your card'),
        row('An Evening of Examples'),
        row('Fri &middot; Feb 12, 2027 &middot; 7:00 PM'),
        row('You got 4 tickets')
      ),
      receivedAt: new Date('2026-11-05T03:00:00Z'),
    })
    expect(promoOnly?.ticketCount).toBe(4)
  })

  it('counts a seat once when one copy drops the section', () => {
    const p = parseEventEmail({
      from: 'noreply@ticketmaster.com',
      subject: 'Jordan Just Sent You Hawks Tickets',
      html: html(
        row('Harbor City Hawks vs Riverside Rockets'),
        row('Thu &bull; Sep 3, 2026 &bull; 07:00 PM'),
        row('Sec 101, Row 5, Seat 3'),
        row('Sec 101, Row 5, Seat 4'),
        row('Row 5, Seat 3'),
        row('Row 5, Seat 4'),
        // The same row and seat in another section is another seat.
        row('Sec 102, Row 5, Seat 3')
      ),
      receivedAt: AUG_2026,
    })
    expect(p?.ticketCount).toBe(3)
  })

  it('never reads running copy ("10 Tickets left") as a Gametime count', () => {
    const p = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Your Ticket Order - Rockets @ Hawks on 3/14',
      html: html(
        row('Only 10 Tickets left for the next game!'),
        row('Order Details Order #'),
        row('ZQ7TEST123'),
        row('Riverside Rockets at Harbor City Hawks'),
        row('Saturday, March 14, 6:40pm'),
        row('Example Arena'),
        row('Springfield,'),
        row('CA')
      ),
      receivedAt: MAR_2026,
    })
    expect(p?.ticketCount).toBeNull()
  })

  it('reads a Gametime count labelled "Ticket(s)"', () => {
    const p = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Your Ticket Order - Rockets @ Hawks on 3/14',
      html: html(
        row('Order Details Order #'),
        row('ZQ7TEST123'),
        row('Rockets at Hawks'),
        row('2'),
        row('Ticket(s)')
      ),
      receivedAt: MAR_2026,
    })
    expect(p?.ticketCount).toBe(2)
  })

  it('takes the title from before the date when the time sits in its own cell', () => {
    const p = parseEventEmail({
      from: 'noreply@ticketmaster.com',
      subject: 'Jordan Just Sent You 2 Hawks Tickets',
      html: html(
        row('Harbor City Hawks vs Riverside Rockets'),
        row('Sat, Mar 14'),
        row('6:40 PM'),
        row('Example Arena, Springfield, CA')
      ),
      receivedAt: MAR_2026,
    })
    expect(p).toMatchObject({
      title: 'Harbor City Hawks vs Riverside Rockets',
      when: { month: 3, day: 14, hour: 18, minute: 40 },
    })
  })

  it('keeps a transfer that lands after the event in the year of the event', () => {
    const p = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: 'Your Ticket Has Been Accepted by Pat',
      html: html(
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM'),
        row('Example Arena, Springfield, CA')
      ),
      receivedAt: new Date('2026-03-20T18:00:00Z'),
    })
    expect(p?.when).toMatchObject({ year: 2026, month: 3, day: 14 })
  })
})

describe('venues and states', () => {
  it('keeps a hyphenated venue name whole', () => {
    expect(findVenue(' ¶ Example-Name Arena, Springfield, CA ¶')).toEqual({
      venue: 'Example-Name Arena',
      city: 'Springfield',
      state: 'CA',
    })
  })

  it('accepts only real states, so a gate or a bare capitalised word is no state', () => {
    expect(findVenue(' ¶ Example Arena, Bayside, Gate B ¶')).toEqual({
      venue: null,
      city: null,
      state: null,
    })
    expect(findVenue(' ¶ Example Arena, Bayside, ZZ ¶').state).toBeNull()
    // Outside the US: the venue and city still read, with no state.
    expect(findVenue(' ¶ Example Arena - Lakeview, ON ¶')).toEqual({
      venue: 'Example Arena',
      city: 'Lakeview',
      state: null,
    })
    expect(findVenue(' ¶ Example Arena, Bayside, New Hampshire ¶').state).toBe('NH')
  })
})

describe('resolveEventDate (mayArriveLate)', () => {
  const late = { mayArriveLate: true }
  const when = { year: null, month: 1, day: 5, hour: 19, minute: 0 }

  it('takes a recent past occurrence, across a year boundary', () => {
    expect(
      resolveEventDate({ ...when, month: 12, day: 28 }, new Date('2027-01-03T00:00:00Z'), late).year
    ).toBe(2026)
  })

  it('keeps the next occurrence for an email sent ahead of the event', () => {
    expect(resolveEventDate(when, new Date('2026-12-20T00:00:00Z'), late).year).toBe(2027)
    // Months ahead: last year's same date is too old to be a late arrival, so a
    // delivery notice and its purchase still land on one date.
    const oct9 = { ...when, month: 10, day: 9 }
    const received = new Date('2026-03-01T18:00:00Z')
    expect(resolveEventDate(oct9, received, late).year).toBe(2026)
    expect(resolveEventDate(oct9, received).year).toBe(2026)
  })
})

describe('matching', () => {
  it('gives one game the same key on two platforms despite different titles', () => {
    const gametime = parseEventEmail({
      from: 'receipts@e.gametime.co',
      subject: 'Your Ticket Order - Rockets @ Hawks on 3/14',
      html: GAMETIME_ORDER,
      receivedAt: MAR_2026,
    })
    const tm = parseEventEmail({
      from: 'customer_support@email.ticketmaster.com',
      subject: '- sent you ticket(s) for Harbor City Hawks vs. Riverside Rockets',
      html: html(
        row('Harbor City Hawks vs. Riverside Rockets'),
        row('Sat, Mar 14 @ 6:40 PM'),
        row('Example Arena, Springfield, CA')
      ),
      receivedAt: MAR_2026,
    })
    expect(eventMatchKey(gametime!)).toBe('2026-03-14|v:examplearena')
    expect(eventMatchKey(tm!)).toBe(eventMatchKey(gametime!))
  })

  it('normalizes case, punctuation and a leading "the"', () => {
    expect(normalizeForMatch('The Field')).toBe(normalizeForMatch('field '))
    expect(normalizeForMatch('Sample Hall, Inc.')).toBe('samplehallinc')
  })

  it('falls back to the title without a venue, and has no key without a date', () => {
    const base = {
      title: 'A Show',
      venue: null,
      when: { year: 2026, month: 3, day: 9, hour: 20, minute: 0 },
    }
    expect(eventMatchKey(base as never)).toBe('2026-03-09|t:ashow')
    expect(eventMatchKey({ ...base, when: null } as never)).toBeNull()
  })

  it('infers sports from a matchup or a sports word, and nothing else', () => {
    expect(inferCategory('Harbor City Hawks vs. Riverside Rockets')).toEqual({
      category: 'sports',
      teams: ['Harbor City Hawks', 'Riverside Rockets'],
    })
    expect(inferCategory('Hawks Training Camp')).toEqual({ category: 'sports', teams: null })
    expect(inferCategory('An Evening of Examples')).toEqual({ category: 'other', teams: null })
  })

  it('reads " at " as a matchup only between two full team names', () => {
    expect(inferCategory('Riverside Rockets at Harbor City Hawks').category).toBe('sports')
    expect(inferCategory('Night at the Example Museum')).toEqual({ category: 'other', teams: null })
    expect(inferCategory('Live at Sample Hall')).toEqual({ category: 'other', teams: null })
    expect(inferCategory('Rockets @ Hawks').category).toBe('sports')
  })

  it('reads a place after "@" or " at " as a show, not a matchup', () => {
    expect(inferCategory('Comedy Night @ The Improv')).toEqual({ category: 'show', teams: null })
    expect(inferCategory('Example Band at Sample Bowl')).toEqual({ category: 'other', teams: null })
    // The email's own venue gives the place away even without a venue word.
    expect(inferCategory('Example Band at Sample Spot', 'Sample Spot')).toEqual({
      category: 'other',
      teams: null,
    })
    expect(inferCategory('Example Band World Tour at Sample Bowl').category).toBe('concert')
    // A home team that starts the venue's name is still a team.
    expect(inferCategory('Example State at Lakeside Tech', 'Lakeside Tech Stadium').category).toBe(
      'sports'
    )
  })

  it('keeps a round or event-type label out of the team names', () => {
    expect(inferCategory('Round 1: Riverside Rockets at Harbor City Hawks: Game 3')).toEqual({
      category: 'sports',
      teams: ['Riverside Rockets', 'Harbor City Hawks'],
    })
    expect(inferCategory('Preseason - Riverside Rockets at Harbor City Hawks').teams).toEqual([
      'Riverside Rockets',
      'Harbor City Hawks',
    ])
  })

  it('recognises concerts and stage shows by their words', () => {
    expect(inferCategory('An Evening with the Example Symphony').category).toBe('concert')
    expect(inferCategory('Example Jazz Festival 2026').category).toBe('concert')
    expect(inferCategory('Sample Players: A Musical').category).toBe('show')
  })

  it('folds accents, so accented and plain spellings match', () => {
    expect(normalizeForMatch('Théâtre Exemple')).toBe(normalizeForMatch('Theatre Exemple'))
    expect(normalizeForMatch('Théâtre Exemple')).toBe('theatreexemple')
  })
})
