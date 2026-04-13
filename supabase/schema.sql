-- ============================================================
-- Gym tracking schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Workouts (one per session)
CREATE TABLE workouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('lift', 'run', 'bodyweight', 'other')),
  body_weight_lbs DECIMAL(5,1),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Exercises within a workout
CREATE TABLE workout_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- e.g. "Push-up", "Squat"
  variant_grip  TEXT,                  -- e.g. "Wide", "Neutral"
  variant_form  TEXT,                  -- e.g. "Decline", "Diamond"
  distance_miles  DECIMAL(6,2),        -- for runs
  duration_minutes INTEGER,            -- for runs
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Individual sets within an exercise
CREATE TABLE exercise_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  reps        INTEGER NOT NULL,
  weight_lbs  DECIMAL(6,2),           -- null for bodyweight
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────
CREATE INDEX workouts_date_idx ON workouts(date DESC);
CREATE INDEX workout_exercises_workout_id_idx ON workout_exercises(workout_id);
CREATE INDEX exercise_sets_exercise_id_idx ON exercise_sets(exercise_id);

-- ── Row-level security ────────────────────────────────────
-- Only authenticated users (i.e. you) can read/write
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users can do everything" ON workouts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth users can do everything" ON workout_exercises
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth users can do everything" ON exercise_sets
  FOR ALL USING (auth.role() = 'authenticated');

-- Public read-only for the portfolio (optional — remove if you want it private)
CREATE POLICY "public read" ON workouts
  FOR SELECT USING (true);

CREATE POLICY "public read" ON workout_exercises
  FOR SELECT USING (true);

CREATE POLICY "public read" ON exercise_sets
  FOR SELECT USING (true);
