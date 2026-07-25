-- Seed for the Weight Room load achievement ladder (#336).
--
-- Split from `weight_room_load_achievements` because it was applied to the
-- `court-vision` project under its own ledger name, and a migration file's
-- `<name>` must match the name it was applied under (see CLAUDE.md § Database
-- migrations) — the filename timestamp and the applied version are unrelated,
-- so the name is the only key tying the two sides together.
--
-- Runs after the table exists; `on conflict do nothing` on the metric index
-- keeps re-applying idempotent and never clobbers a threshold the owner has
-- since retuned.

-- Seed the load ladder. Calibrated against the real log as of 2026-07-25, with
-- the shrug multiplier applied: best day 11,925 lb, best week 36,300, best
-- month 106,870, best single set 1,400, top load 120 (60s in each hand).
-- Weighted pushups/pullups have no logged sets yet, so those tiers open
-- unearned — a ladder to chase once a vest or belt goes on.
insert into public.weight_room_achievements (label, exercise, scope, measure, threshold, color, icon)
values
  -- Shrugs — tonnage moved per window.
  ('Five-Grand Day',        'shrugs', 'day',   'tonnage',   5000, '#C9A268', '🏋️'),
  ('Ten-Grand Day',         'shrugs', 'day',   'tonnage',  10000, '#B08D4F', '🏋️'),
  ('Fifteen-Grand Day',     'shrugs', 'day',   'tonnage',  15000, '#8A6D3B', '🔩'),
  ('Twenty-Five-Grand Week','shrugs', 'week',  'tonnage',  25000, '#C9A268', '📅'),
  ('Forty-Grand Week',      'shrugs', 'week',  'tonnage',  40000, '#B08D4F', '🗓️'),
  ('Seventy-Five-Grand Month','shrugs','month','tonnage',  75000, '#C9A268', '🏅'),
  ('Hundred-Fifty-Grand Month','shrugs','month','tonnage',150000, '#8A6D3B', '🏆'),
  -- Shrugs — one unbroken set, by weight moved. 2000 lb is a literal ton.
  ('Half-Ton Set',          'shrugs', 'set',   'tonnage',   1000, '#C9A268', '💪'),
  ('One-Ton Set',           'shrugs', 'set',   'tonnage',   2000, '#B08D4F', '🦾'),
  ('Ton-and-a-Half Set',    'shrugs', 'set',   'tonnage',   3000, '#8A6D3B', '🦾'),
  -- Shrugs — top-set load PRs, in total pounds carried (both dumbbells).
  ('Eighty-Pound Carry',    'shrugs', 'set',   'load',        80, '#C9A268', '⚖️'),
  ('Hundred-Pound Carry',   'shrugs', 'set',   'load',       100, '#B08D4F', '⚖️'),
  ('Hundred-Twenty Carry',  'shrugs', 'set',   'load',       120, '#8A6D3B', '⚖️'),
  ('Hundred-Forty Carry',   'shrugs', 'set',   'load',       140, '#DC2626', '🔥'),
  ('Hundred-Sixty Carry',   'shrugs', 'set',   'load',       160, '#A21CAF', '👑'),

  -- Weighted pushups — vest load (single implement, multiplier 1).
  ('Twenty-Pound Vest',     'pushups','set',   'load',        20, '#EA580C', '⚖️'),
  ('Thirty-Five-Pound Vest','pushups','set',   'load',        35, '#DC2626', '⚖️'),
  ('Forty-Five-Pound Vest', 'pushups','set',   'load',        45, '#A21CAF', '👑'),

  -- Weighted pullups — dip-belt load.
  ('Twenty-Five-Pound Belt','pullups','set',   'load',        25, '#0EA5A1', '⚖️'),
  ('Forty-Five-Pound Belt', 'pullups','set',   'load',        45, '#0D9488', '⚖️'),
  ('Seventy-Pound Belt',    'pullups','set',   'load',        70, '#A21CAF', '👑'),

  -- Pooled tonnage across every movement. Shrugs carry these alone today;
  -- they start meaning something broader once another lift gets loaded.
  ('Fifteen-Grand Day',     null,     'day',   'tonnage',  15000, '#F5D08A', '🏋️'),
  ('Fifty-Grand Week',      null,     'week',  'tonnage',  50000, '#EAB308', '🗓️'),
  ('Six-Figure Month',      null,     'month', 'tonnage', 100000, '#CA8A04', '🏆')
on conflict do nothing;
