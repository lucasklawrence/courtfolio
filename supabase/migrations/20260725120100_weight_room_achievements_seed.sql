-- Seed for the Weight Room achievement ladder (#336).
--
-- Split from `weight_room_achievements` because it was applied to the
-- `court-vision` project under its own ledger name, and a migration file's
-- `<name>` must match the name it was applied under (see CLAUDE.md § Database
-- migrations) — the filename timestamp and the applied version are unrelated,
-- so the name is the only key tying the two sides together.
--
-- Runs after the table exists; `on conflict do nothing` on the metric index
-- keeps re-applying idempotent and never clobbers a threshold the owner has
-- since retuned.

-- Seed the default ladder. Thresholds are calibrated against the real log as of
-- 2026-07-25 so the wall opens with a handful already earned and a long tail to
-- chase — a ladder where everything is unlocked (or nothing is) motivates
-- nothing. Reference bests at seed time: pushups 180/day, 790/week, 2336/month,
-- 4746 lifetime, 15/set; pullups 100/day, 275/week, 816/month, 1501 lifetime,
-- 10/set; pooled 540/day, 2491/week, 7480/month, 10575 lifetime; longest streak
-- 17 days (shrugs).
--
-- `on conflict do nothing` on the metric index keeps re-applying idempotent and
-- never clobbers a threshold the owner has since retuned.
insert into public.weight_room_achievements (label, exercise, scope, threshold, color, icon)
values
  -- Pushups — daily volume. The 100 tier is the standing daily goal.
  ('Century Club',        'pushups', 'day',      100, '#EA580C', '💯'),
  ('Century and a Half',  'pushups', 'day',      150, '#F97316', '🔥'),
  ('Double Century',      'pushups', 'day',      200, '#DC2626', '⚡'),
  ('Triple Century',      'pushups', 'day',      300, '#A21CAF', '👑'),
  -- Pushups — weekly / monthly volume.
  ('Five-Hundred Week',   'pushups', 'week',     500, '#EA580C', '📅'),
  ('Seven-Fifty Week',    'pushups', 'week',     750, '#F97316', '📅'),
  ('Four-Figure Week',    'pushups', 'week',    1000, '#DC2626', '🗓️'),
  ('Two-Grand Month',     'pushups', 'month',   2000, '#EA580C', '🏅'),
  ('Three-Grand Month',   'pushups', 'month',   3000, '#DC2626', '🏅'),
  ('Five-Grand Month',    'pushups', 'month',   5000, '#A21CAF', '🏆'),
  -- Pushups — lifetime + single set.
  ('Five Thousand Club',  'pushups', 'lifetime', 5000, '#EA580C', '🎖️'),
  ('Ten Thousand Club',   'pushups', 'lifetime',10000, '#DC2626', '🎖️'),
  ('Twenty-Five K Club',  'pushups', 'lifetime',25000, '#A21CAF', '💎'),
  ('Twenty Unbroken',     'pushups', 'set',       20, '#EA580C', '💪'),
  ('Twenty-Five Unbroken','pushups', 'set',       25, '#F97316', '💪'),
  ('Thirty Unbroken',     'pushups', 'set',       30, '#DC2626', '🦾'),
  -- Pushups — streaks.
  ('Perfect Week',        'pushups', 'streak',     7, '#EA580C', '🔥'),
  ('Perfect Fortnight',   'pushups', 'streak',    14, '#F97316', '🔥'),
  ('Perfect Month',       'pushups', 'streak',    30, '#DC2626', '☄️'),

  -- Pullups — the daily goal is 30, so the ladder starts above it.
  ('Half Century',        'pullups', 'day',       50, '#0EA5A1', '💯'),
  ('Seventy-Five',        'pullups', 'day',       75, '#14B8A6', '🔥'),
  ('Century Club',        'pullups', 'day',      100, '#0D9488', '👑'),
  ('Two-Hundred Week',    'pullups', 'week',     200, '#0EA5A1', '📅'),
  ('Three-Hundred Week',  'pullups', 'week',     300, '#14B8A6', '📅'),
  ('Five-Hundred Week',   'pullups', 'week',     500, '#0D9488', '🗓️'),
  ('Grand Month',         'pullups', 'month',   1000, '#0EA5A1', '🏅'),
  ('Fifteen-Hundred Month','pullups','month',   1500, '#0D9488', '🏆'),
  ('Twenty-Five Hundred Club', 'pullups', 'lifetime', 2500, '#0EA5A1', '🎖️'),
  ('Five Thousand Club',  'pullups', 'lifetime', 5000, '#14B8A6', '🎖️'),
  ('Ten Thousand Club',   'pullups', 'lifetime',10000, '#0D9488', '💎'),
  ('Twelve Unbroken',     'pullups', 'set',       12, '#0EA5A1', '💪'),
  ('Fifteen Unbroken',    'pullups', 'set',       15, '#14B8A6', '💪'),
  ('Twenty Unbroken',     'pullups', 'set',       20, '#0D9488', '🦾'),
  ('Perfect Week',        'pullups', 'streak',     7, '#0EA5A1', '🔥'),
  ('Perfect Fortnight',   'pullups', 'streak',    14, '#14B8A6', '🔥'),
  ('Perfect Month',       'pullups', 'streak',    30, '#0D9488', '☄️'),

  -- Squats.
  ('Century Club',        'squats',  'day',      100, '#2563EB', '💯'),
  ('Double Century',      'squats',  'day',      200, '#1D4ED8', '⚡'),
  ('Five-Hundred Week',   'squats',  'week',     500, '#2563EB', '📅'),
  ('Four-Figure Week',    'squats',  'week',    1000, '#1D4ED8', '🗓️'),
  ('Two-Grand Month',     'squats',  'month',   2000, '#2563EB', '🏅'),
  ('Five Thousand Club',  'squats',  'lifetime', 5000, '#1D4ED8', '🎖️'),
  ('Perfect Week',        'squats',  'streak',     7, '#2563EB', '🔥'),
  ('Perfect Month',       'squats',  'streak',    30, '#1D4ED8', '☄️'),

  -- Shrugs (the current monthly focus movement).
  ('Century Club',        'shrugs',  'day',      100, '#C9A268', '💯'),
  ('Double Century',      'shrugs',  'day',      200, '#B08D4F', '⚡'),
  ('Four-Figure Week',    'shrugs',  'week',    1000, '#C9A268', '🗓️'),
  ('Three-Grand Month',   'shrugs',  'month',   3000, '#B08D4F', '🏅'),
  ('Five Thousand Club',  'shrugs',  'lifetime', 5000, '#C9A268', '🎖️'),
  ('Perfect Fortnight',   'shrugs',  'streak',    14, '#C9A268', '🔥'),
  ('Perfect Month',       'shrugs',  'streak',    30, '#B08D4F', '☄️'),

  -- Pooled "all movements" ladder (exercise IS NULL).
  ('Triple Threat',        null, 'day',        300, '#F5D08A', '🎯'),
  ('Five-Hundred Day',     null, 'day',        500, '#EAB308', '🎯'),
  ('Seven-Fifty Day',      null, 'day',        750, '#CA8A04', '🌟'),
  ('Fifteen-Hundred Week', null, 'week',      1500, '#F5D08A', '📅'),
  ('Twenty-Five-Hundred Week', null, 'week',  2500, '#EAB308', '🗓️'),
  ('Four-Grand Week',      null, 'week',      4000, '#CA8A04', '🌟'),
  ('Five-Grand Month',     null, 'month',     5000, '#F5D08A', '🏅'),
  ('Seventy-Five-Hundred Month', null, 'month', 7500, '#EAB308', '🏆'),
  ('Ten-Grand Month',      null, 'month',    10000, '#CA8A04', '👑'),
  ('Ten Thousand Reps',    null, 'lifetime', 10000, '#F5D08A', '🎖️'),
  ('Twenty-Five K Reps',   null, 'lifetime', 25000, '#EAB308', '💎'),
  ('Fifty K Reps',         null, 'lifetime', 50000, '#CA8A04', '💎'),
  ('Hundred K Reps',       null, 'lifetime',100000, '#A21CAF', '👑'),
  ('Week of Work',         null, 'streak',       7, '#F5D08A', '🔥'),
  ('Fortnight of Work',    null, 'streak',      14, '#EAB308', '🔥'),
  ('Month of Work',        null, 'streak',      30, '#CA8A04', '☄️'),
  ('Sixty-Day Grind',      null, 'streak',      60, '#DC2626', '☄️'),
  ('Hundred-Day Grind',    null, 'streak',     100, '#A21CAF', '👑')
on conflict do nothing;
