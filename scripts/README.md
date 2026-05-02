# scripts

## `import-health`

`npm run import-health -- path/to/export.zip`

Reads an Apple Health `export.zip` (the file you get from Health → Profile → Export All Health Data on iOS) and writes the cardio data into Supabase — the dataset the Gym detail views consume via `getCardioData()` (`lib/data/cardio.ts`).

The wrapper does three things:

1. Spawns `python scripts/preprocess-health.py <export.zip> public/data/cardio.json` to produce an intermediate JSON file.
2. Validates the result against a Zod mirror of `CardioData` (`types/cardio.ts`) so any drift between the Python script and the TypeScript type fails loudly here, not at runtime in the dashboard.
3. Upserts every session, resting-HR point, and VO2max point into the three `cardio_*` Supabase tables via the service-role key. Idempotent — re-running the import after a fresh Apple Health export overwrites the same primary keys (`started_at` for sessions, `date` for trends) instead of duplicating rows.

### Optional flags

- `--max-hr=185` — your max heart rate (BPM), used to bucket samples into the five Z1–Z5 zones. Defaults to 185 (matches `DEFAULT_MAX_HR` in `constants/hr-zones.ts`). Pass a measured max from a treadmill test if you have one.
- `--from-json=<path>` — skip the Python preprocess and re-upsert from an already-produced JSON file. Useful for retrying just the Supabase write after a transient connection failure.

### Required env vars

The script reads the same Supabase env vars as the rest of the app (`.env.local`, see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key. **Server/local only.** Never check it in.

### What lands in Supabase

Three tables (PRD §7.4, migration in `supabase/migrations/20260430120000_cardio_tables.sql`):

- `cardio_sessions` — stair / running / walking workouts with avg HR, max HR, time-in-zone breakdown (5 explicit columns), and cardiac efficiency aggregated from the raw HR sample stream.
- `cardio_resting_hr` — one row per measurement day.
- `cardio_vo2max` — one row per measurement day.

Everything else from the Apple Health export (HRV, walking HR average, body mass, step counts, sleep, active energy, plus non-tracked workout types like cycling and rowing) is dropped. Bring fields back when a chart consumes them.

### Privacy

The intermediate `public/data/cardio.json` is **gitignored** because Apple Health exports include personal medical metrics. The `cardio_*` Supabase rows are **publicly readable** through the anon key — RLS allows `select` for `anon`/`authenticated` so the dashboard can render without sign-in, which means anyone with the public Supabase URL can hit the REST endpoint and download the cardio data. That's intentional for this single-user portfolio site (Lucas's data is the *content*), but worth knowing before pushing data you wouldn't put on a public résumé. To make rows private instead, replace the `using (true)` clause in `supabase/migrations/20260430120000_cardio_tables.sql` with an authenticated-user check and re-apply the migration.

### Requirements

- Python 3.9+ on `PATH` (override with `PYTHON=…` if needed)
- The repo's `node_modules` (zod + `@supabase/supabase-js`)
- `.env.local` populated with the Supabase service-role credentials

## `cardio:backfill`

`npm run cardio:backfill`

One-shot importer for the legacy `public/data/cardio.json` from the pre-Supabase architecture. Reads the JSON sitting at `public/data/cardio.json` (or a custom path: `npm run cardio:backfill -- ./fixtures/cardio.json`), validates it against the same `CardioData` schema as `import-health`, and upserts every row into Supabase.

Idempotent (same upsert path as `import-health`), so re-running is harmless. After the backfill succeeds the JSON can be left on disk as a debug artifact or deleted — Supabase is now the source of truth.
