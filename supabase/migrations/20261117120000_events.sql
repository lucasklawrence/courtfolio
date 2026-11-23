-- Events ingested from ticket-platform emails (#502).
--
-- TWO TABLES, BECAUSE ONE EMAIL IS NOT ONE EVENT. A single outing produces a
-- reseller receipt, a Ticketmaster transfer (resellers deliver venue-restricted
-- tickets that way) and a reminder — three emails on two platforms with three
-- different titles for the same game. `event_emails` keeps one row per email
-- as evidence; `events` keeps one row per outing; the importer links them by
-- the event's local date and venue (`match_key`).
--
-- STATUS IS DERIVED WHEN READ, NOT STORED. "Upcoming" stops being true the
-- moment an event starts, so a stored status is stale between importer runs.
-- `events_with_status` works out status, how the tickets were acquired, the
-- ticket count and the cost from the evidence on every read, and applies the
-- owner's corrections from `events.manual_override`, which the importer never
-- writes.
--
-- PRIVATE: NO ANON OR AUTHENTICATED ACCESS. Event history says where the owner
-- has been, transfers name the people they went with, and the receipts carry
-- what was paid. Row-level security cannot hide individual columns, so instead
-- of a policy that would expose every column of every past row, there is no
-- policy at all: RLS is on, nothing is granted, and the importer and the
-- Wrapped summary use the service-role key, which bypasses RLS. A future page
-- that shows events gets its own narrow view then. The views below run with
-- the caller's rights (`security_invoker`), so they cannot be used to read
-- around the tables' RLS either.
--
-- Not in scripts/sync-staging.mjs's table list: staging gets the schema from
-- this migration but no rows, which is right for private data.
--
-- All DDL is idempotent so re-applying is a safe no-op.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  -- "<local date>|v:<normalized venue>" (or "|t:<normalized title>" when no
  -- email named a venue). How emails from different platforms find the same
  -- event; see eventMatchKey in scripts/lib/events-parser.mjs.
  match_key text not null unique,
  title text not null,
  category text not null default 'other',
  subcategory text,
  teams text[],
  starts_at timestamptz not null,
  venue text,
  city text,
  state text,
  -- Owner corrections: any of title, category, subcategory, status,
  -- acquired_via, ticket_count, cost_total. The importer never writes this
  -- column, so a correction survives every re-import.
  manual_override jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.events is
  'One row per event attended or ticketed, built from ticket-platform emails (#502). The evidence is in event_emails; status, acquisition, ticket count and cost are derived in events_with_status. Service-role only: no anon or authenticated access.';

do $$
begin
  alter table public.events
    add constraint events_category_check
    check (category in ('sports', 'concert', 'show', 'party', 'other'));
exception when duplicate_object then null;
end $$;

create index if not exists events_starts_at_idx on public.events (starts_at desc);

create table if not exists public.event_emails (
  -- Gmail's message id: the idempotency key. Re-reading the same mail updates
  -- its parsed fields and adds nothing.
  gmail_message_id text primary key,
  -- Null for an email that could not be matched to an event (no date, or an
  -- order notice); those are the review list.
  event_id uuid references public.events (id) on delete set null,
  platform text not null,
  kind text not null,
  subject text,
  received_at timestamptz not null,
  order_ref text,
  ticket_count integer check (ticket_count is null or ticket_count > 0),
  cost_total numeric(10, 2) check (cost_total is null or cost_total >= 0),
  cost_currency text,
  -- Who sent the tickets (transfer in) or received them (transfer out).
  counterpart text,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  note text,
  ingested_at timestamptz not null default now()
);

comment on table public.event_emails is
  'One row per ticket-platform email (#502): what kind it is and what it says about an event. Evidence for events_with_status. Rows with no event_id or confidence below 0.7 are listed in event_emails_review. Service-role only.';

do $$
begin
  alter table public.event_emails
    add constraint event_emails_kind_check
    check (kind in ('purchase', 'transfer_in', 'transfer_out', 'fulfilment', 'reminder',
                    'post_event', 'notice', 'unrecognized'));
exception when duplicate_object then null;
end $$;

create index if not exists event_emails_event_id_idx on public.event_emails (event_id);

alter table public.events enable row level security;
alter table public.event_emails enable row level security;

-- Supabase grants anon and authenticated table privileges by default; take
-- them back so nothing but the service role can even attempt a read.
revoke all on public.events from anon, authenticated;
revoke all on public.event_emails from anon, authenticated;

-- Every event with its derived fields.
--
-- Tickets held = the larger of the tickets bought and the tickets received
-- (a reseller's delivery transfer repeats the purchase's tickets, so the two
-- are not added). Orders are counted once each, whichever of their emails
-- carried the figures.
--
-- Status, first rule that applies:
--   manual override
--   transferred_away  every held ticket was sent on
--   upcoming          has not started
--   attended          a post-event email, or a reminder received on the day
--   likely_attended   started, tickets held, no sign of passing them on
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
evidence as (
  select
    m.event_id,
    sum(m.ticket_count) filter (where m.kind = 'transfer_in') as tickets_in,
    sum(m.ticket_count) filter (where m.kind = 'transfer_out') as tickets_out,
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
    nullif(greatest(coalesce(b.tickets, 0), coalesce(v.tickets_in, 0)), 0) as derived_ticket_count,
    b.cost as derived_cost_total,
    v.tickets_out,
    v.has_transfer_out,
    coalesce(v.has_post_event, false) or coalesce(v.has_day_of_reminder, false) as has_attendance_signal
  from public.events e
  left join bought b on b.event_id = e.id
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
      -- A transfer out whose count either side didn't state is read as all
      -- of them: a partial hand-off (one ticket to a companion) states its count.
      when d.has_transfer_out
           and (d.derived_ticket_count is null or d.tickets_out is null
                or d.tickets_out >= d.derived_ticket_count)
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
  'events with status, acquired_via, ticket_count and cost derived from event_emails on every read, then manual_override applied (#502). security_invoker: no more readable than the tables.';

-- Emails that need a look: unmatched (no date, or an order notice) or read
-- with low confidence. The importer logs only the count; this is where the
-- rows are.
create or replace view public.event_emails_review
with (security_invoker = true) as
select gmail_message_id, platform, kind, subject, received_at, confidence, note, event_id
from public.event_emails
where (event_id is null and kind <> 'notice') or confidence < 0.7
order by received_at desc;

comment on view public.event_emails_review is
  'Ticket emails that could not be matched to an event or were read with confidence below 0.7 (#502). Order notices are stored but not listed: they carry no event details by design.';

revoke all on public.events_with_status from anon, authenticated;
revoke all on public.event_emails_review from anon, authenticated;

-- The year summary life's Wrapped builder embeds verbatim (life#2005, ADR
-- 0088 there). Counts events in p_year, by America/Los_Angeles date, that
-- started before p_as_of, so it stops where every other chapter of the file
-- stops. Events passed on to someone else, or marked not attended, are not
-- events attended and are left out. Service role only: the cost figures are
-- the owner's, and the caller embeds the result in a private local file.
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
    'free_ticket_rate', (
      select round(avg(case when acquired_via <> 'purchased' or coalesce(cost_total, 0) = 0
                            then 1 else 0 end)::numeric, 3)
      from counted),
    'cost_total', (select sum(cost_total) from counted where acquired_via = 'purchased'),
    'cost_per_event', (
      select round(avg(cost_total), 2) from counted
      where acquired_via = 'purchased' and cost_total is not null),
    'emails_needing_review', (select count(*) from public.event_emails_review)
  );
$$;

comment on function public.wrapped_events_summary(integer, timestamptz) is
  'Year summary of attended events for life''s Wrapped builder (#502; life#2005). Counts events in p_year (America/Los_Angeles) that started before p_as_of. Service role only.';

revoke all on function public.wrapped_events_summary(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.wrapped_events_summary(integer, timestamptz) to service_role;
