# scripts

## `import-health`

`npm run import-health -- path/to/export.zip`

Reads an Apple Health `export.zip` (the file you get from Health → Profile → Export All Health Data on iOS) and writes the cardio data into Supabase — the dataset the Gym detail views consume via `getCardioData()` (`lib/data/cardio.ts`).

The wrapper does three things:

1. Spawns `python scripts/preprocess-health.py <export.zip> public/data/cardio.json` to produce an intermediate JSON file.
2. Validates the result against a Zod mirror of `CardioData` (`types/cardio.ts`) so any drift between the Python script and the TypeScript type fails loudly here, not at runtime in the dashboard.
3. Upserts every session, trend point, and lifestyle metric into the nine `cardio_*` Supabase tables via the service-role key. Idempotent — re-running the import after a fresh Apple Health export overwrites the same primary keys (`started_at` for sessions, `date` for trends) instead of duplicating rows.

### Optional flags

- `--max-hr=185` — your max heart rate (BPM), used to bucket samples into the five Z1–Z5 zones. Defaults to 185 (matches `DEFAULT_MAX_HR` in `constants/hr-zones.ts`). Pass a measured max from a treadmill test if you have one.
- `--from-json=<path>` — skip the Python preprocess and re-upsert from an already-produced JSON file. Useful for retrying just the Supabase write after a transient connection failure.

### Required env vars

The script reads the same Supabase env vars as the rest of the app (`.env.local`, see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key. **Server/local only.** Never check it in.

### What lands in Supabase

Nine tables (PRD §7.4):

Cardio core (`supabase/migrations/20260430120000_cardio_tables.sql`):

- `cardio_sessions` — stair / running / walking workouts with avg HR, max HR, time-in-zone breakdown (5 explicit columns), and cardiac efficiency aggregated from the raw HR sample stream.
- `cardio_resting_hr` — one row per measurement day.
- `cardio_vo2max` — one row per measurement day.

Lifestyle trends (`supabase/migrations/20260506120000_cardio_lifestyle_trends.sql`, #75 slice C-data):

- `cardio_hrv_trend` — heart-rate variability (SDNN), one row per day, latest-wins.
- `cardio_walking_hr_trend` — walking HR average, one row per day, latest-wins.
- `cardio_body_mass_trend` — body mass, one row per day, latest-wins; values normalized to **lbs** at preprocess time (Apple Health `kg` is converted up-front).
- `cardio_step_count_trend` — daily step total, one row per day, summed from Apple's per-burst step records.
- `cardio_sleep_trend` — total asleep time per **wake-day** (the calendar day you woke up — Apple Health's convention) in hours; only `HKCategoryValueSleepAnalysisAsleep*` periods are counted, in-bed-but-awake time is excluded.
- `cardio_active_energy_trend` — daily active-energy total in kcal, summed from per-burst records (kJ → kcal normalized at preprocess time).

Non-tracked workout types from the Apple Health export (cycling, rowing, etc.) are dropped — bring those back when a Gym detail view supports them.

### Privacy

The intermediate `public/data/cardio.json` is **gitignored** because Apple Health exports include personal medical metrics. The `cardio_*` Supabase rows are **publicly readable** through the anon key — RLS allows `select` for `anon`/`authenticated` so the dashboard can render without sign-in, which means anyone with the public Supabase URL can hit the REST endpoint and download the cardio data. That's intentional for this single-user portfolio site (Lucas's data is the *content*), but worth knowing before pushing data you wouldn't put on a public résumé. To make rows private instead, replace the `using (true)` clause in `supabase/migrations/20260430120000_cardio_tables.sql` with an authenticated-user check and re-apply the migration.

The same public-read RLS now applies to the slice C-data lifestyle tables — `cardio_hrv_trend`, `cardio_walking_hr_trend`, `cardio_body_mass_trend`, `cardio_step_count_trend`, `cardio_sleep_trend`, `cardio_active_energy_trend`. Body mass, sleep duration, and step count are arguably more personal than the cardio session data, so think twice before importing fresh metrics. The same `using (true)` → authenticated swap on the lifestyle tables' migration flips them private without touching the cardio side.

### Requirements

- Python 3.9+ on `PATH` (override with `PYTHON=…` if needed)
- The repo's `node_modules` (zod + `@supabase/supabase-js`)
- `.env.local` populated with the Supabase service-role credentials

## `cardio:backfill`

`npm run cardio:backfill`

One-shot importer for the legacy `public/data/cardio.json` from the pre-Supabase architecture. Reads the JSON sitting at `public/data/cardio.json` (or a custom path: `npm run cardio:backfill -- ./fixtures/cardio.json`), validates it against the same `CardioData` schema as `import-health`, and upserts every row into Supabase.

Idempotent (same upsert path as `import-health`), so re-running is harmless. After the backfill succeeds the JSON can be left on disk as a debug artifact or deleted — Supabase is now the source of truth.
