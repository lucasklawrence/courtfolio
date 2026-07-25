# scripts

## `await-*.ps1` — bounded polling helpers

Three PowerShell scripts that replace the ad-hoc `until <check>; do sleep N; done` shell loops that piled up across `/ship-issue` runs. Each has a real timeout (no more hanging on a vanished check) and exit codes a caller can branch on: `0` on success, `2` on timeout, `1` on usage error.

Allowlisted in `.claude/settings.json` for both `powershell -File` (Windows PowerShell 5.1) and `pwsh -File` (PowerShell 7+). The examples below use `powershell` for brevity — substitute `pwsh` on macOS/Linux or wherever PowerShell 7 is the only edition on PATH. Prefer these helpers over raw `until` loops — see `CLAUDE.md` § Polling and waiting.

### `await-pr-checks.ps1`

Poll a GitHub PR's status checks until they reach terminal state (`SUCCESS`, `FAILURE`, `ERROR`, `CANCELLED`).

```
powershell -File scripts/await-pr-checks.ps1 -Pr <num> [-Check all|Vercel|e2e|CodeRabbit] [-TimeoutSec 600] [-PollSec 15]
```

Examples:

- Wait on every check: `powershell -File scripts/await-pr-checks.ps1 -Pr 192`
- Wait only on Vercel: `powershell -File scripts/await-pr-checks.ps1 -Pr 192 -Check Vercel`

### `await-url.ps1`

Poll a URL until it responds with a matching HTTP status. Default pattern accepts `200`, redirects, and `404` — all proof that the server is serving.

```
powershell -File scripts/await-url.ps1 -Url <url> [-StatusPattern '^200$'] [-TimeoutSec 60] [-PollSec 2]
```

Example: `powershell -File scripts/await-url.ps1 -Url http://localhost:3000/training-facility`

### `await-log-pattern.ps1`

Poll a file until a regex matches its contents. The file need not exist yet — the script waits for it to appear, then watches for the pattern.

```
powershell -File scripts/await-log-pattern.ps1 -Path <path> -Pattern <regex> [-TimeoutSec 60] [-PollSec 1]
```

Example (waiting for `next dev` to be ready):

```
powershell -File scripts/await-log-pattern.ps1 -Path "$env:TEMP/claude/.../task.output" -Pattern 'Ready in'
```

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

The intermediate `public/data/cardio.json` is **gitignored** because Apple Health exports include personal medical metrics. The `cardio_*` Supabase rows are **publicly readable** through the anon key — RLS allows `select` for `anon`/`authenticated` so the dashboard can render without sign-in, which means anyone with the public Supabase URL can hit the REST endpoint and download the cardio data. That's intentional for this single-user portfolio site (Lucas's data is the _content_), but worth knowing before pushing data you wouldn't put on a public résumé. To make rows private instead, replace the `using (true)` clause in `supabase/migrations/20260430120000_cardio_tables.sql` with an authenticated-user check and re-apply the migration.

The same public-read RLS now applies to the slice C-data lifestyle tables — `cardio_hrv_trend`, `cardio_walking_hr_trend`, `cardio_body_mass_trend`, `cardio_step_count_trend`, `cardio_sleep_trend`, `cardio_active_energy_trend`. Body mass, sleep duration, and step count are arguably more personal than the cardio session data, so think twice before importing fresh metrics. The same `using (true)` → authenticated swap on the lifestyle tables' migration flips them private without touching the cardio side.

### Requirements

- Python 3.9+ on `PATH` (override with `PYTHON=…` if needed)
- The repo's `node_modules` (zod + `@supabase/supabase-js`)
- `.env.local` populated with the Supabase service-role credentials

## `cardio:backfill`

`npm run cardio:backfill`

One-shot importer for the legacy `public/data/cardio.json` from the pre-Supabase architecture. Reads the JSON sitting at `public/data/cardio.json` (or a custom path: `npm run cardio:backfill -- ./fixtures/cardio.json`), validates it against the same `CardioData` schema as `import-health`, and upserts every row into Supabase.

Idempotent (same upsert path as `import-health`), so re-running is harmless. After the backfill succeeds the JSON can be left on disk as a debug artifact or deleted — Supabase is now the source of truth.

## `import-otbeat`

`npm run import-otbeat`

Pulls Orangetheory **OTbeat "Studio Workout Summary"** emails from Gmail, parses each one, and appends new sessions to the `otf_sessions` Supabase table (#251). This is what backs the OrangeTheory data the Gym surfaces consume.

Pipeline:

1. `scripts/import-otbeat.mjs` exchanges a Gmail OAuth **refresh token** for an access token (native `fetch`, no Google SDK), then queries `from:OTbeatReport@orangetheoryfitness.com newer_than:{OTBEAT_LOOKBACK_DAYS}d` (default 8 — see below).
2. For each match it reads the `text/html` body (the treadmill/rower stats live only there) and runs `parseOtbeatHtml` (`scripts/lib/otbeat-parser.mjs`) → a structured record (date, time, coach, studio, zone minutes, calories, splat, HR, steps, `treadmill{}`, `rower{}`).
3. `upsertOtfSessions` (`scripts/lib/otbeat-supabase.mjs`) **appends** rows whose `started_at` isn't already present.

**Append-only, never prunes** — unlike `import-health`/`cardio:backfill`, which mirror a full Apple Health archive and delete rows missing from it. OTbeat is an incremental weekly email pull, so re-running over the overlap window adds 0 (idempotent) and history is never lost. The `started_at` timestamp is built from the email's local date/time interpreted in the studio timezone (`America/Los_Angeles`).

### Lookback window

`OTBEAT_LOOKBACK_DAYS` (default `8`) controls the Gmail query window. It's deliberately wider than the weekly cron so a skipped run self-heals. For a full historical backfill, widen it:

```bash
OTBEAT_LOOKBACK_DAYS=3650 npm run import-otbeat
```

### Scheduled run (GitHub Action)

`.github/workflows/otbeat-ingest.yml` runs the import weekly (Mondays 14:00 UTC) and on manual `workflow_dispatch`. It writes straight to Supabase — it does **not** commit anything back to git — so it needs no `contents: write` permission. The interactive Claude/Gmail integration used for the one-time backfill is **not** available to this headless job, which is why it has its own OAuth refresh token.

### Required env vars / GitHub secrets

Local runs read `.env.local`; the Action reads repo **Actions secrets**. Both need:

- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` — the OAuth client credentials.
- `GMAIL_REFRESH_TOKEN` — long-lived token authorizing `gmail.readonly` on the inbox that receives the OTbeat emails.
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same service-role write path as the cardio imports. **Server/CI only, never commit.**

### One-time Gmail OAuth setup

1. **Google Cloud Console** → create/pick a project → **APIs & Services → Library** → enable the **Gmail API**.
2. **OAuth consent screen** → _External_ → add the receiving Gmail address as a **Test user** → add scope `https://www.googleapis.com/auth/gmail.readonly`.
3. **Credentials → Create credentials → OAuth client ID** → _Web application_ → add authorized redirect URI `https://developers.google.com/oauthplayground`. Copy the **Client ID** and **Client secret**.
4. **Get a refresh token** at [OAuth 2.0 Playground](https://developers.google.com/oauthplayground): gear icon → _Use your own OAuth credentials_ → paste the client id/secret → in the left panel authorize `https://www.googleapis.com/auth/gmail.readonly` → _Exchange authorization code for tokens_ → copy the **refresh token**. (The playground requests `access_type=offline` + `prompt=consent`, so a refresh token is returned.)
5. **Add the five secrets** in GitHub → _Settings → Secrets and variables → Actions_ (and to `.env.local` for local runs).
6. **Verify**: _Actions → OTbeat ingest → Run workflow_. A healthy first run logs `added 0 … (already present)` if the backfill already covered everything, or `added N` for genuinely new sessions.

### Schema & privacy

Table: `supabase/migrations/20260628120000_otf_sessions.sql`. Like the `cardio_*` tables, `otf_sessions` is **publicly readable** via the anon key (RLS `using (true)`) so the dashboard renders without sign-in. Flip it private by swapping `using (true)` for an authenticated check and re-applying. Zone minutes are explicit columns; the treadmill and rower blocks are JSONB (`null` on class formats that omit them — e.g. tread-only days, and the occasional belt-malfunction "4 calorie" summary).

### Data-quality gate

The run **exits non-zero** if any counted (non-`excluded`) session lacks a `class_type`. Such a row matches no filter chip in the OTF view, so it silently vanishes from the log and every aggregate — three sessions sat that way for 20 days before anyone noticed (#334). The importer also backfills a *null* `class_type` on rows already present, so a future ingest/migration race repairs itself on the next pull; anything the lookback window can't reach is what the exit code is for.

## `migrations:check`

`npm run migrations:check`

Compares the `.sql` files in `supabase/migrations/` against the migrations actually recorded as applied, and fails when they disagree. Add `--allow-untracked` to downgrade the applied-with-no-file case to a warning, or `--json` for a machine-readable report.

Why it exists: a migration's **filename timestamp and its applied version are unrelated**. Files carry a synthetic stamp chosen when written (`20260430120000_cardio_tables.sql`); Supabase records the moment it ran (`20260501063801`). The only shared key is the name, so nothing was comparing them, and drift accumulated in both directions — `create_movement_benchmarks` was applied for three months with no file in the repo, meaning a rebuild from source produced a database missing that table entirely.

Two failure modes, treated differently:

- **Committed but not applied** — always fails. This is the shape of the #271 race that left three OTF sessions unreachable.
- **Applied but no file** — fails locally, *reported* in CI. Since the convention is apply-then-commit, a sibling PR's migration is legitimately applied while its file sits on an unmerged branch, so any branch cut from `main` would otherwise fail through no fault of its own.

Reads the ledger through the `public.applied_migrations()` RPC because PostgREST exposes just `public` and `graphql_public` — selecting `supabase_migrations.schema_migrations` directly returns PGRST106. The function is `SECURITY DEFINER`, returns `version` and `name` only, and is granted to `anon`.

Exits 0 in sync, 1 on drift, **2 when it cannot tell** — an unreachable database must never read as a pass.

### Required env vars

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. It **must not** use the service-role key: the CI job runs this script from a pull-request checkout and triggers on changes to the script itself, so a PR could rewrite it to exfiltrate whatever is in the job env, and service-role bypasses RLS on production entirely. The anon key is read-only and bounded by RLS, and granting the RPC to `anon` leaks nothing extra — every migration name it returns is already on GitHub in this public repo.

Both are stored as **repo secrets**, not variables. Despite the `NEXT_PUBLIC_` prefix the anon key isn't actually published today: the training-facility routes that would inline it into a client bundle are flag-gated off in production, and RLS is `using (true)` for reads, so that key is currently the only thing between the internet and the fitness data. A public repo has public Actions logs, and secrets get redacted from them where variables don't. (Masking only stops *accidental* logging — a deliberately malicious PR can print anything in its env either way. What protects this job is that nothing privileged is in it.)

Deliberately uses plain `fetch` rather than `@supabase/supabase-js`, which needs a native WebSocket and throws on Node 20 — a drift check that only runs on the newest Node is one that gets skipped.

### Writing a migration

1. Write the file first, `<version>_<name>.sql`. The `<name>` must match the name you apply it under — it's the only key tying the file to the ledger.
2. Apply it with the Supabase `apply_migration` tool (or the CLI), which records it. **Never** run schema DDL through `execute_sql` or a raw query: that changes the database without recording anything.
3. Commit the file. A migration applied from an uncommitted file is drift the moment the session ends.

Write DDL idempotently (`create table if not exists`, `add column if not exists`, `create policy` inside a `do $$ ... exception when duplicate_object $$` block) and guard backfill `update`s with `where <col> is null`.
