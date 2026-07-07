-- Weight Room concurrent upper + lower monthly focuses (#286). Extends the
-- "grease the groove" monthly-focus model (#255,
-- `20260628120000_weight_room_monthly_focus.sql`) so two campaigns can run
-- at the same time — an upper-body lane and a lower-body lane — instead of a
-- single rotating slot.
--
-- Adds one column:
--
--   * weight_room_monthly_focus.category — 'upper' | 'lower'. The read layer
--     resolves one active focus *per category* (most-recent start_date wins
--     within a lane, see `lib/training-facility/monthly-focus.ts`), so the
--     Today / Log view renders up to two focus rings alongside the permanent
--     pushups / pullups / squats rings.
--
-- Additive + idempotent: add nullable column, backfill existing rows, then
-- promote to NOT NULL + a CHECK. Re-applying on a fresh dev project (or after
-- a branch reset) is a safe no-op.

-- 1. Nullable first so existing rows survive the add.
alter table public.weight_room_monthly_focus
  add column if not exists category text;

-- 2. Backfill. The only seeded focus so far is shrugs (traps) — upper body.
update public.weight_room_monthly_focus
  set category = 'upper'
  where category is null;

-- 3. Now that every row carries a value, require it.
alter table public.weight_room_monthly_focus
  alter column category set not null;

-- 4. Constrain to the two lanes. `add constraint` has no IF NOT EXISTS, so
--    swallow the duplicate on re-apply.
do $$
begin
  alter table public.weight_room_monthly_focus
    add constraint weight_room_monthly_focus_category_check
      check (category in ('upper', 'lower'));
exception when duplicate_object then null;
end $$;

comment on column public.weight_room_monthly_focus.category is
  'Body-region lane for the focus: ''upper'' or ''lower'' (#286). The read layer surfaces one active focus per category (most-recent start_date wins within a lane), enabling concurrent upper + lower monthly focuses.';
