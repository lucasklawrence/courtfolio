# scripts

## `worktree-init.ps1` — make a fresh worktree usable

```
powershell -File scripts/worktree-init.ps1
```

Run once after entering a new worktree. `git worktree add` copies the *tracked* files and nothing else, so a bare worktree is missing the two untracked things this repo needs:

- **`node_modules`** — `vitest.config.ts` aliases `server-only` to `path.resolve(__dirname, 'node_modules/server-only/empty.js')`, an **absolute** path inside the worktree. Node's own resolution would walk up to the main checkout, but the alias never does, so ~22 test files fail with `Cannot find module 'server-only'`.
- **`.env.local`** — gitignored, so `migrations:check`, `import-otbeat`, and `staging:sync` all fail on missing Supabase credentials until it's copied.

### Shared junction, except when dependencies differ

For a normal branch the script creates a directory **junction** to the main checkout's `node_modules` — no disk cost, no second install.

When the branch changes `package.json` or `package-lock.json` it does a real `npm ci` in the worktree instead, because sharing would be wrong twice over:

- The suite would run against a tree that doesn't match the branch — green on a package the branch deleted, red on one it added.
- The obvious repair, `npm install`, writes **through** the junction into the main checkout's `node_modules`, corrupting every other worktree that shares it and any session mid-test-run.

`-Link` forces the junction anyway, for when you know the dependency delta is irrelevant to what you're running. Know what it shares before reaching for it.

### Adding a dependency: `-Isolate`

The check above reads the *committed* diff, so it can only see a dependency change that already exists. On a branch where you're **about to** add one, there's nothing to detect yet — you get a junction, and the `npm install` you run next writes through it into the main checkout. That's the trap, and it's easy to walk into because nothing looks wrong until something else breaks.

Two ways out, depending on when you notice:

```
powershell -File scripts/worktree-init.ps1 -Isolate   # before: skip the junction entirely
powershell -File scripts/worktree-init.ps1            # after:  re-run, it detects the edit
```

`-Isolate` forces a real install up front. And because the working tree is now checked too, simply **re-running the bootstrap** after editing `package.json` repairs a worktree that was already junctioned — it unlinks and installs for real. That's what `CLAUDE.md`'s "re-run the bootstrap" instruction has always promised; before this it did nothing.

`-Isolate` and `-Link` contradict each other, so passing both is an error rather than a silent precedence rule.

Which install command runs depends on whether the lockfile can be trusted:

| situation | command | why |
|---|---|---|
| committed dependency change | `npm ci` | branch carries a coherent `package.json` + lock |
| uncommitted `package.json` edit | `npm install` | lock hasn't caught up; `ci` **refuses** outright |
| `-Isolate`, clean tree | `npm ci` | nothing has changed yet — install the lock, then add your package |

That middle row is the whole reason the distinction exists. `npm ci` fails with *"can only install packages when your package.json and package-lock.json are in sync"* — so on the exact state this feature is for, a plain `ci` would leave the worktree with **no** `node_modules`, which is worse than where it started.

Safe to re-run: an existing junction, an existing real install, and an existing `.env.local` are all left alone (`-Force` overwrites the env file). So a re-run is a no-op on a normal branch, but **does** repeat the install on a dependency branch — slow, and the only way to stay correct about a lockfile that may have moved.

Refuses to run in the main checkout, where `node_modules` is real. Exits `0` when ready, `1` if run from the wrong place, the main checkout has no install to link, `-Isolate` and `-Link` are combined, or the install fails.

Without this, the first thing a new worktree shows you is a wall of red tests — which is how a worktree convention dies. See `CLAUDE.md` § Work in a worktree.

## `worktree-remove.ps1` — take a worktree down safely

```
powershell -File scripts/worktree-remove.ps1 -Path .claude/worktrees/<slug>
```

The counterpart to `worktree-init.ps1`, and **not optional if that script linked the worktree**.

`git worktree remove` deletes the worktree directory recursively and does *not* step over a directory junction — it deletes straight **through** `node_modules` into the main checkout's real installation, leaving it empty. Every other worktree points at the same target, so they all break together, and the symptom is a confusing wall of module-resolution errors rather than anything that names the cause.

This is not hypothetical: it happened to this repo's main checkout minutes after a note claiming `git worktree remove` "handles this correctly on its own" was written. It doesn't.

So the order is a script, not a thing to remember:

1. Unlink `node_modules` if it's a junction (`cmd /c rmdir` — removes the link only).
2. `git worktree remove --force`.
3. Delete the branch unless `-KeepBranch`.
4. **Verify the main checkout's install is still populated** and fail loudly with the repair command if not — checking a real file inside it, since the failure leaves an empty directory that any `Test-Path node_modules` would call fine.

A worktree with a *real* `node_modules` (a dependency-changing branch) is left for git to delete normally — there's no link to follow. Refuses to remove the worktree the current shell is standing in, and refuses any path `git worktree list` doesn't know, so a typo can't delete something unrelated.

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

## `import-otf-bookings`

`node scripts/import-otf-bookings.mjs <path-to.ics>` — or `OTF_ICS_PATH=<path> npm run import-otf-bookings`

Reads OTF class bookings from a calendar into `otf_bookings`, then matches them to `otf_sessions` to resolve `class_format`.

**Why it exists:** the OTbeat email carries no class-template token whatsoever — nothing says "2G", "3G", or "Tread 50" anywhere in the body. `class_type` is inferred from which machine blocks the class logged and therefore cannot tell a 2G from a 3G, so everything grouped by it silently mixes templates. The template lives only in the booking calendar, in event titles like `Orange 60 Min 3G`.

Inference was tried and doesn't work: a day-of-week rule mislabels 2026-07-22 (a Wednesday 3G), and block-time inference fails independently because that same 3G logged only 03:40 of rower time. The template has to be read, never guessed.

### Phase A scope

The calendar source is a local `.ics` file, so this is a manual run against an export. Phase B (#453) adds a CalDAV source against `caldav.icloud.com` behind the same `CalendarSource` interface and moves the two steps into `otbeat-ingest.yml`.

### Required env vars

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same pair as `import-otbeat`.

### What it will and won't do

- **Never drops a booking.** A title that doesn't match the grammar is stored with `title_raw` intact and null parsed columns, and logged. A guessed format would be worse than none.
- **Never overwrites a manual label.** A session whose `class_format_source` is `'manual'` is skipped entirely.
- **Idempotent.** Bookings upsert on the calendar event UID; the reconcile writes only columns that are currently null, so a second run is a no-op.
- **Self-heals.** A session linked to a booking whose title couldn't be parsed picks up the format on a later run once the grammar handles it — append-only writes alone can't do that, which is what left three sessions broken for 20 days (#334).
- **Leaves drop-ins null.** Roughly 9% of sessions are booked outside the app flow and have no calendar event (2026-08-06 at Mar Vista is one). Those are reported, never failed on, and stay null unless labeled by hand.

### Data-quality gate

Unlike `import-otbeat`, this run does **not** exit non-zero for sessions missing a `class_format` — legitimate drop-ins would keep it permanently red, which just trains everyone to ignore it. `findBookingFeedSilence` (sessions arriving with zero bookings in the same window — the revoked-app-password signature) is built and unit-tested but deliberately unwired until Phase B gives it a producer that makes it meaningful.

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

## `staging:sync`

`npm run staging:sync`

Copies production data into the staging Supabase project (`court-vision-preview`, ref `tztrsfefesacnbreerhp`), which exists so preview deploys can render realistic data without holding a credential that can write production.

Rows stream directly between the two PostgREST endpoints — a full refresh is ~45k rows, dominated by `cardio_session_hr_samples`, and none of it passes through a CI log or an agent's memory.

**Staging is a snapshot, not a mirror.** Nothing dual-writes to it: the OTbeat cron, the `log-workout` / `log-weight` skills, and the Apple Health import all target production only. So staging is stale from the moment a sync finishes, and it looks convincingly current — never read it to answer a question about the data.

Semantics:

- **Upsert** on each table's key, so production edits propagate (a corrected weight, a hand-entered `class_format`, a hand-flipped `excluded`).
- Rows existing **only** in staging survive, so hand-made test data isn't clobbered.
- **Deletions do not propagate.** Accepted deliberately — a delete-aware sync needs a prune pass or a truncate-and-reload, and truncating would destroy the staging-only rows the previous point protects. Rebuild the project if that matters.

Two tables use `mode: 'replace'` (clear staging, then insert production verbatim) rather than upsert: `weight_room_achievements` and `weight_room_monthly_focus`. Both have a `gen_random_uuid()` primary key **and** are seeded by a migration, so each project generates its *own* id for the same logical row. Upserting on `id` therefore never matches, and the follow-up insert either trips a unique business-key index or — where none exists — silently duplicates the row. That's not hypothetical: the first real run 409'd on `weight_room_achievements` and had quietly left staging with two July shrugs focuses against production's one.

Conflicting on the natural key instead isn't available: `weight_room_achievements` enforces uniqueness through two *partial* indexes (`where exercise is not null` / `where exercise is null`), and PostgREST's `on_conflict` can't supply an index predicate. Replace avoids inference entirely and carries production's ids over, so row identity is stable across projects.

Replace reads the entire replacement set from production *before* deleting anything, so a transient read failure can't leave staging's reference table empty — which would render as "no badges" in a preview rather than as an error. That leaves one clear-then-insert window; closing it completely would take a transactional delete-and-insert RPC on staging, deliberately not built, since that's a migration on both projects to protect a table that a re-run rebuilds.

Only mark a table `replace` if losing staging-only rows in it is acceptable — these two are reference data nobody hand-edits. It also buffers the whole table in memory, which is fine at ~93 rows and would not be for `cardio_session_hr_samples`.

Production often runs *ahead* of `main` (a branch's migration gets applied before its PR merges), so each row is projected onto the columns staging actually has; unknown columns are dropped and reported rather than 400-ing the table.

`panel_runs` is deliberately not synced: it's service-role-only in production, and live-panel history doesn't affect what a preview renders.

### Required env vars

| Var | Why |
|---|---|
| `PROD_SUPABASE_URL` | Read source. |
| `PROD_SUPABASE_ANON_KEY` | Anon suffices — every synced table has an RLS `using (true)` SELECT policy. The job must **never** hold production's service-role key; a workflow that can write production defeats the point of staging. |
| `STAGING_SUPABASE_URL` | Write target. |
| `STAGING_SUPABASE_SECRET_KEY` | Staging RLS grants anon SELECT only, and the OpenAPI schema endpoint used for column discovery requires a secret key. |

Exits 0 on success, 1 if any table failed, 2 on missing config — including a guard that refuses to run when both URLs point at the same project.

The `staging-sync` workflow runs it Sundays at 08:00 UTC (an hour after the OTbeat ingest, so a refresh includes that morning's classes) and on `workflow_dispatch` for "make staging current before I review this preview".

### Writing a migration

1. Write the file first, `<version>_<name>.sql`. The `<name>` must match the name you apply it under — it's the only key tying the file to the ledger.
2. Apply it with the Supabase `apply_migration` tool (or the CLI), which records it. **Never** run schema DDL through `execute_sql` or a raw query: that changes the database without recording anything.
3. Commit the file. A migration applied from an uncommitted file is drift the moment the session ends.

Write DDL idempotently (`create table if not exists`, `add column if not exists`, `create policy` inside a `do $$ ... exception when duplicate_object $$` block) and guard backfill `update`s with `where <col> is null`.
