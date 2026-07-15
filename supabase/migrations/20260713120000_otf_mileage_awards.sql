-- OrangeTheory monthly-mileage milestone awards (#321).
--
-- Backs the "Marathon Month" mileage view on the OTF surface
-- (`components/training-facility/gym/OtfDetailView.tsx`): a per-calendar-month
-- total of treadmill + rower miles that unlocks milestone badges (half
-- marathon, marathon, ultra, …) as the month's total crosses each threshold.
--
-- WHY A DEDICATED TABLE (not a code constant): the ladder is owner-editable at
-- runtime — add/rename/retune a tier without a deploy — so the tiers live in
-- Supabase and are managed through an admin-gated API route
-- (`app/api/admin/otf/mileage-awards/*`), mirroring the Weight Room goals /
-- monthly-focus model. The public OTF card reads them (anon SELECT); the awards
-- earned per month are recomputed from the session data on every render
-- (stateless — nothing is persisted per-month).
--
-- RLS mirrors `otf_sessions`: anon + authenticated SELECT only. Writes go
-- through the service-role key via the admin API route.
--
-- This file is the canonical record of the migration; it is also applied to the
-- `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`) via the Supabase
-- tooling. All DDL is idempotent so re-applying on a fresh dev project (or after
-- a branch reset) is a safe no-op.

create table if not exists public.otf_mileage_awards (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  miles numeric not null check (miles > 0),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.otf_mileage_awards is
  'Monthly-mileage milestone awards for the OTF "Marathon Month" view (#321). One row per badge tier: a label + a mileage threshold (miles) + optional display color. A calendar month earns every tier whose threshold its treadmill+rower mileage total reaches. Owner-editable at runtime via the admin API route; the label is unique so tiers do not collide. Read anon (SELECT); written only through the service-role admin route.';

comment on column public.otf_mileage_awards.miles is
  'Mileage threshold in miles. A month earns this badge when its cumulative treadmill (distance_mi) + rower (distance_m / 1609.344) total reaches this value. Must be positive.';

comment on column public.otf_mileage_awards.color is
  'Optional hex badge tint (e.g. #F97316). Null lets the UI fall back to a default accent.';

-- The ladder is almost always scanned ordered by threshold.
create index if not exists otf_mileage_awards_miles_idx
  on public.otf_mileage_awards (miles);

alter table public.otf_mileage_awards enable row level security;

-- Postgres has no `create policy if not exists`; swallow the duplicate-object
-- error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read otf mileage awards"
    on public.otf_mileage_awards
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- Seed the default ladder. `on conflict (label) do nothing` keeps re-applying
-- idempotent and never clobbers a threshold the owner has since retuned.
insert into public.otf_mileage_awards (label, miles, color)
values
  ('Half Marathon', 13.1, '#FBBF24'),
  ('Marathon', 26.2, '#F97316'),
  ('50K Ultra', 31.1, '#EA580C'),
  ('50-Mile Ultra', 50, '#DC2626'),
  ('Century', 100, '#A21CAF')
on conflict (label) do nothing;
