-- Corrections to the events view and the Wrapped summary (#502 review).
--
-- 1. TRANSFERS ARE COUNTED ONCE PER PERSON. A single hand-off can produce more
--    than one email (Ticketmaster's "sent" notice and a later reminder of the
--    same transfer, or a re-sent offer), and summing every transfer email
--    counted those tickets twice. Tickets in and out are now the largest count
--    stated for each counterpart, added across counterparts.
--
-- 2. "TRANSFERRED AWAY" NEEDS EVIDENCE THAT EVERY TICKET WENT. A transfer out
--    with no stated count is still read as all of them (a partial hand-off
--    states its count), but a stated count is only compared against a known
--    number held: with nothing to compare it to, the event stays attended or
--    likely attended instead of disappearing from the year.
--
-- 3. THE FREE-TICKET RATE COUNTS ONLY WHAT IS KNOWN. A ticket is free when it
--    was transferred in, or bought for a stated total of zero. An event whose
--    acquisition or cost is unknown is left out of the rate entirely rather
--    than counted as free.
--
-- Columns are unchanged, so `create or replace` is enough and re-applying is a
-- no-op. Grants on the view and the function survive a replace.

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
-- hand-off's emails stated. Emails naming nobody share one bucket.
transfers as (
  select event_id, kind, max(ticket_count) as tickets
  from public.event_emails
  where kind in ('transfer_in', 'transfer_out') and event_id is not null
  group by event_id, kind, coalesce(counterpart, '')
),
moved as (
  select event_id,
         sum(tickets) filter (where kind = 'transfer_in') as tickets_in,
         sum(tickets) filter (where kind = 'transfer_out') as tickets_out
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

create or replace function public.wrapped_events_summary(p_year integer, p_as_of timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with counted as (
    select *
    from public.events_with_status
    where extract(year from starts_at at time zone 'America/Los_Angeles') = p_year
      and starts_at < p_as_of
      and status in ('attended', 'likely_attended')
  ),
  venues as (
    select venue, count(*) as n from counted where venue is not null
    group by venue order by n desc, venue limit 1
  ),
  months as (
    select to_char(starts_at at time zone 'America/Los_Angeles', 'YYYY-MM') as month, count(*) as n
    from counted group by 1 order by n desc, month limit 1
  )
  select jsonb_build_object(
    'year', p_year,
    'as_of', p_as_of,
    'events', (select count(*) from counted),
    'by_category', coalesce(
      (select jsonb_object_agg(category, n)
       from (select category, count(*) as n from counted group by category) c),
      '{}'::jsonb),
    'top_venue', (select jsonb_build_object('venue', venue, 'events', n) from venues),
    'cities', coalesce(
      (select jsonb_agg(jsonb_build_object('city', city, 'state', state, 'events', n)
                        order by n desc, city)
       from (select city, state, count(*) as n from counted where city is not null
             group by city, state) c),
      '[]'::jsonb),
    'busiest_month', (select jsonb_build_object('month', month, 'events', n) from months),
    -- Free = transferred in, or bought for a stated zero. Events whose
    -- acquisition or cost is unknown are not in the denominator.
    'free_ticket_rate', (
      select round(avg(case when acquired_via = 'transfer_in' or cost_total = 0
                            then 1 else 0 end)::numeric, 3)
      from counted
      where acquired_via = 'transfer_in'
         or (acquired_via = 'purchased' and cost_total is not null)),
    'cost_total', (select sum(cost_total) from counted where acquired_via = 'purchased'),
    'cost_per_event', (
      select round(avg(cost_total), 2) from counted
      where acquired_via = 'purchased' and cost_total is not null),
    'emails_needing_review', (select count(*) from public.event_emails_review)
  );
$$;

revoke all on function public.wrapped_events_summary(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.wrapped_events_summary(integer, timestamptz) to service_role;
revoke all on public.events_with_status from anon, authenticated;
