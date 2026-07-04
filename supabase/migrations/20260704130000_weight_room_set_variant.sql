-- Weight Room per-set exercise variants (#254). Extends the strength
-- model (#79, `20260507120000_weight_room_tables.sql`) with an optional
-- free-text *variant* per logged set — the grip / width / tempo used
-- for that set (e.g. `wide`, `close`, `neutral` for pullups).
--
-- The variant is deliberately NOT part of any goal key or the daily
-- ring rollup: `weight_room_goals` still keys on the bare exercise, and
-- `totalsByExercise` sums every variant of an exercise into that
-- exercise's single ring. The column exists purely so the History View
-- can *slice* an exercise's volume by variant ("pullups this month: 60%
-- wide, 30% close, 10% unspecified") without fragmenting the rollup.
--
-- Nullable, no backfill, no default: every existing row reads as
-- "unspecified" (null), and bodyweight sets logged without a grip stay
-- null. Mirrors the nullable `weight_lbs` column added in
-- `20260628120000_weight_room_monthly_focus.sql`. Idempotent so
-- re-applying on a fresh dev project (or after a branch reset) is a safe
-- no-op.

alter table public.weight_room_sets
  add column if not exists variant text;

comment on column public.weight_room_sets.variant is
  'Optional free-text exercise variant for this set — the grip / width / tempo used (e.g. ''wide'', ''close''). Null = unspecified. NOT part of the goal key or the daily-ring rollup (every variant of an exercise sums into that exercise''s ring); exists only so the History View can slice an exercise''s volume by variant. Writes lowercase + trim the value (see variantWriteField in lib/schemas/weight-room.ts) to keep case-divergent duplicates (''Wide'' vs ''wide'') from splitting a bucket.';
