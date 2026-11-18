-- Transfer emails that name nobody no longer add to the ones that do (#502
-- review, round 1).
--
-- 20261118120000 counted transfers once per counterpart, but put every email
-- naming nobody into a bucket of its own and added it to the named ones. One
-- Ticketmaster hand-off routinely sends both: "Jordan sent you 2 tickets"
-- names the sender, and the "You're all set to see ..." confirmation that
-- follows does not. Those two emails still summed to four tickets, so an event
-- whose two tickets were then sent on read as still attended.
--
-- Now named hand-offs add up, and the unnamed emails can only raise that total
-- to their own largest count, never add to it. That can undercount an unnamed
-- transfer that really was separate, which errs the right way: the held count
-- is already the larger of bought and received, and a short count of tickets
-- sent on keeps an event in the year instead of dropping it.
--
-- Columns are unchanged, so `create or replace` is enough and re-applying is a
-- no-op. Grants on the view survive a replace.

create or replace view public.events_with_status
with (security_invoker = true) as
with orders as (
  select distinct on (event_id, coalesce(order_ref, gmail_message_id))
    event_id, ticket_count, cost_total, cost_currency
  from public.event_emails
  where kind = 'purchase' and event_id is not null
  order by event_id, coalesce(order_ref, gmail_message_id), cost_total desc nulls last
),
bought as (
  select event_id,
         sum(ticket_count) as tickets,
         sum(cost_total) as cost,
         min(cost_currency) as currency,
         count(*) as orders
  from orders
  group by event_id
),
-- One row per (event, direction, person): the largest count any of that
-- hand-off's emails stated. Emails naming nobody form one more row.
transfers as (
  select event_id, kind, counterpart, max(ticket_count) as tickets
  from public.event_emails
  where kind in ('transfer_in', 'transfer_out') and event_id is not null
  group by event_id, kind, counterpart
),
-- Named hand-offs add up; an unnamed email may repeat any of them, so it can
-- raise the total but never add to it. greatest() ignores nulls.
moved as (
  select event_id,
         greatest(
           sum(tickets) filter (where kind = 'transfer_in' and counterpart is not null),
           max(tickets) filter (where kind = 'transfer_in' and counterpart is null)
         ) as tickets_in,
         greatest(
           sum(tickets) filter (where kind = 'transfer_out' and counterpart is not null),
           max(tickets) filter (where kind = 'transfer_out' and counterpart is null)
         ) as tickets_out
  from transfers
  group by event_id
),
evidence as (
  select
    m.event_id,
    bool_or(m.kind = 'transfer_in') as has_transfer_in,
    bool_or(m.kind = 'transfer_out') as has_transfer_out,
    bool_or(m.kind = 'post_event') as has_post_event,
    bool_or(m.kind = 'reminder'
            and (m.received_at at time zone 'America/Los_Angeles')::date
                = (e.starts_at at time zone 'America/Los_Angeles')::date) as has_day_of_reminder,
    array_agg(distinct m.counterpart) filter (where m.kind = 'transfer_in' and m.counterpart is not null)
      as from_people,
    array_agg(distinct m.counterpart) filter (where m.kind = 'transfer_out' and m.counterpart is not null)
      as companions,
    array_agg(distinct m.platform) as platforms,
    array_agg(m.gmail_message_id order by m.received_at) as source_message_ids,
    min(m.confidence) as min_confidence
  from public.event_emails m
  join public.events e on e.id = m.event_id
  group by m.event_id
),
derived as (
  select
    e.*,
    b.orders,
    coalesce(b.currency, 'USD') as cost_currency,
    v.from_people,
    v.companions,
    v.platforms,
    v.source_message_ids,
    v.min_confidence,
    case when b.orders > 0 then 'purchased'
         when v.has_transfer_in then 'transfer_in'
         else 'unknown' end as derived_acquired_via,
    nullif(greatest(coalesce(b.tickets, 0), coalesce(t.tickets_in, 0)), 0) as derived_ticket_count,
    b.cost as derived_cost_total,
    t.tickets_out,
    v.has_transfer_out,
    coalesce(v.has_post_event, false) or coalesce(v.has_day_of_reminder, false) as has_attendance_signal
  from public.events e
  left join bought b on b.event_id = e.id
  left join moved t on t.event_id = e.id
  left join evidence v on v.event_id = e.id
)
select
  d.id,
  d.match_key,
  coalesce(d.manual_override ->> 'title', d.title) as title,
  coalesce(d.manual_override ->> 'category', d.category) as category,
  coalesce(d.manual_override ->> 'subcategory', d.subcategory) as subcategory,
  d.teams,
  d.starts_at,
  d.venue,
  d.city,
  d.state,
  coalesce(d.manual_override ->> 'acquired_via', d.derived_acquired_via) as acquired_via,
  coalesce((d.manual_override ->> 'ticket_count')::integer, d.derived_ticket_count) as ticket_count,
  coalesce((d.manual_override ->> 'cost_total')::numeric, d.derived_cost_total) as cost_total,
  d.cost_currency,
  coalesce(
    d.manual_override ->> 'status',
    case
      -- No stated count reads as all of them; a stated count must cover
      -- every ticket known to be held.
      when d.has_transfer_out
           and (d.tickets_out is null
                or (d.derived_ticket_count is not null
                    and d.tickets_out >= d.derived_ticket_count))
        then 'transferred_away'
      when d.starts_at > now() then 'upcoming'
      when d.has_attendance_signal then 'attended'
      else 'likely_attended'
    end
  ) as status,
  d.from_people,
  d.companions,
  d.platforms,
  d.source_message_ids,
  d.min_confidence,
  d.manual_override,
  d.created_at,
  d.updated_at
from derived d;

comment on view public.events_with_status is
  'events with status, acquired_via, ticket_count and cost derived from event_emails on every read, then manual_override applied (#502). Transfers count once per counterpart. security_invoker: no more readable than the tables.';

revoke all on public.events_with_status from anon, authenticated;
