-- Weight Room "grease the groove" monthly focus (#255). Extends the
-- strength model (#79, `20260507120000_weight_room_tables.sql`) with a
-- *rotating exercise of the month* — pick one accessory movement, do it
-- every day for a month, then rotate. Adds three things:
--
--   * weight_room_monthly_focus — the rotation roadmap. One row per
--     campaign (exercise + month window + daily target + color). Powers
--     the Today View "Focus of the Month" ring and the "Upcoming" strip.
--     A dedicated table (not a date-window on weight_room_goals) so
--     future-dated and past campaigns live apart from the permanent
--     pushups/pullups goals instead of cluttering that list.
--   * weight_room_sets.weight_lbs — optional per-set load, so weighted
--     focuses (shrugs, carries, …) record the weight used. Null for
--     bodyweight movements; mirrors the cardio model's nullable metrics.
--   * weight_room_goals.kind — 'permanent' vs 'focus'. A focus needs a
--     matching goals row so set-logging satisfies the
--     weight_room_sets.exercise FK and reuses all existing ring/rollup
--     math, but the Today View must only render a focus ring while its
--     window is live (no stale, permanently-empty shrugs ring in August).
--     `kind` lets the read layer tell the two apart.
--
-- RLS mirrors weight_room_goals / weight_room_sets: anon + authenticated
-- SELECT only; writes go through the service-role key via admin-gated API
-- routes. All DDL is idempotent so re-applying on a fresh dev project (or
-- after a branch reset) is a safe no-op.

-- 1. Per-set load. Nullable: existing rows and all bodyweight sets stay null.
alter table public.weight_room_sets
  add column if not exists weight_lbs numeric check (weight_lbs >= 0);

comment on column public.weight_room_sets.weight_lbs is
  'Optional external load in pounds for this set (e.g. weighted shrugs). Null = bodyweight (pushups, pullups). Used by the monthly-focus load stats: top set, avg load, tonnage = sum(reps * weight_lbs).';

-- 2. Permanent vs focus goals. Existing rows default to 'permanent' so the
--    pushups/pullups rings are unchanged.
alter table public.weight_room_goals
  add column if not exists kind text not null default 'permanent'
    check (kind in ('permanent', 'focus'));

comment on column public.weight_room_goals.kind is
  'Whether this goal is a permanent daily ring (''permanent'') or the anchor row for a time-boxed monthly focus (''focus'', see weight_room_monthly_focus). The Today View always renders permanent goals but renders focus goals only while their focus window covers the viewed day.';

-- 3. The rotation roadmap.
create table if not exists public.weight_room_monthly_focus (
  id uuid primary key default gen_random_uuid(),
  exercise text not null references public.weight_room_goals(exercise) on delete cascade,
  daily_target integer not null check (daily_target > 0),
  target_kind text not null default 'reps' check (target_kind in ('reps', 'sets')),
  color text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.weight_room_monthly_focus is
  '"Grease the groove" monthly focus roadmap (#255). One row per time-boxed campaign: an exercise done daily for the [start_date, end_date] window with its own daily_target and color. Past / active / upcoming rows coexist; "upcoming" = start_date > today. The matching weight_room_goals row (kind=''focus'', same exercise) anchors set logging and the daily ring rollup. target_kind ''reps'' fills the ring on rep total; ''sets'' (modeled, unused for July) would fill on distinct-set count.';

-- Roadmap is almost always scanned ordered by window; one set of months.
create index if not exists weight_room_monthly_focus_start_date_idx
  on public.weight_room_monthly_focus (start_date desc);

alter table public.weight_room_monthly_focus enable row level security;

do $$
begin
  create policy "anon and authenticated can read weight room monthly focus"
    on public.weight_room_monthly_focus
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- 4. Seed the first focus: shrugs, July 2026, 100 reps/day, hardwood-tan.
--    The goals anchor row (kind='focus') must exist first to satisfy the
--    monthly-focus FK and to let shrug sets log + roll up like any other
--    exercise. hardwood-tan (#C9A268) is the chartPalette basketball-floor
--    maple token — distinct from pushup rim-orange and pullup teal.
insert into public.weight_room_goals (exercise, daily_target, color, kind)
values ('shrugs', 100, '#C9A268', 'focus')
on conflict (exercise) do nothing;

insert into public.weight_room_monthly_focus
  (exercise, daily_target, target_kind, color, start_date, end_date)
select 'shrugs', 100, 'reps', '#C9A268', date '2026-07-01', date '2026-07-31'
where not exists (
  select 1 from public.weight_room_monthly_focus
  where exercise = 'shrugs' and start_date = date '2026-07-01'
);
