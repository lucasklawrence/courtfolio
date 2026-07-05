# Court Vision — Architecture (C4 Model)

A [C4](https://c4model.com/) view of **Court Vision** (`lucasklawrence.com`) — a basketball‑themed personal
portfolio that doubles as a private personal‑analytics dashboard for fitness data.

**Stack:** Next.js 15 (App Router, RSC) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth) ·
framer‑motion · roughjs + d3‑scale · Zod · Vercel (hosting + Web Analytics). Ingestion/tooling in Node + Python;
CI and scheduled jobs on GitHub Actions.

**Snapshot:** `main` @ `b37fde1` (#279), July 2026.

> **How to read this.** C4 describes software as four nested levels of zoom — **Context** (the system among its
> users and neighbours), **Containers** (separately deployable/runnable things + data stores), **Components**
> (the major building blocks inside a container), and Code. This doc covers L1–L3 plus two supplementary views
> (data ingestion and the data model). All diagrams are Mermaid and render on GitHub. The L1–L3 views
> express C4 semantics as colour‑coded flowcharts — **orange** = the system & its containers, **dark** = people,
> **tan** = external systems, **green cylinders** = data stores, **dashed** = batch/offline jobs — laid out for
> clean arrow routing.

---

## 1. System Context (L1)

Who and what Court Vision talks to.

```mermaid
flowchart LR
  visitor(["Visitor / Recruiter"]):::person
  owner(["Owner / Admin (Lucas)"]):::person
  applehealth["Apple Health"]:::ext
  shortcut["iPhone Health Shortcut"]:::ext
  otf["OrangeTheory"]:::ext
  gmail["Gmail"]:::ext
  cv["Court Vision<br/>Next.js site + fitness dashboard"]:::sys
  supabase[("Supabase<br/>Postgres + Auth")]:::store
  telemetry[("Pub/Sub to BigQuery<br/>telemetry")]:::store
  analytics["Vercel Web Analytics"]:::ext
  aigw["Vercel AI Gateway<br/>(offline only)"]:::ext

  visitor -->|"browses"| cv
  owner -->|"logs workouts, manages data"| cv
  applehealth -->|"on device"| shortcut
  shortcut -->|"POST daily metrics + secret"| cv
  otf -->|"emails summaries"| gmail
  gmail -->|"read by daily cron"| cv
  cv -->|"reads / writes + auth"| supabase
  cv -->|"events & metrics"| telemetry
  cv -->|"page metrics"| analytics
  cv -->|"grades projects (build-time)"| aigw

  classDef person fill:#201b16,stroke:#000000,color:#f5efe1;
  classDef sys fill:#ea580c,stroke:#7c2d12,color:#ffffff;
  classDef ext fill:#efe7d6,stroke:#8a5a2b,color:#2a2018;
  classDef store fill:#e9f5ef,stroke:#2f855a,color:#173d2b;
```

**Actors**

- **Visitor / Recruiter** — the primary audience. Sees the public "arena" (court, locker room, project binder,
  banners, contact) and any flag‑enabled dashboards. No account.
- **Owner / Admin (Lucas)** — authenticates via Supabase magic link; unlocks workout logging, goal/benchmark
  editing, and the `/api/admin/*` write endpoints. Authorization is an email allowlist (`ADMIN_EMAILS`).
- **iPhone Health Shortcut** — a *non‑human* actor. A device automation that reads Apple Health and POSTs daily
  aggregates to the ingest endpoint with a shared secret.

**External systems**

- **Supabase** — the single source of truth (Postgres) and the identity provider (passwordless magic‑link Auth).
- **Gmail + OrangeTheory** — OTF has no public API; it emails per‑class summaries, which the app reads from Gmail.
- **Pub/Sub → BigQuery** — a personal telemetry sink (`koy-engineering`) fed best‑effort from server routes.
- **Vercel Web Analytics** — client‑side RUM beacon.
- **Vercel AI Gateway** — used **only offline** (build/authoring time) to generate the Draft Room's judge‑panel
  result; the deployed app makes **no** LLM calls at request time.

---

## 2. Containers (L2)

The separately runnable pieces and where data lives. Note the deliberate split: the **browser client reads
Supabase directly** (anon key under RLS) — there is no read API — while **every write uses the service‑role
key** — through an auth‑gated server route for app writes, or straight to Postgres from the batch ingestion
jobs (§4). The browser never writes.

```mermaid
flowchart LR
  visitor(["Visitor / Recruiter"]):::person
  owner(["Owner / Admin"]):::person
  applehealth["Apple Health"]:::ext
  shortcut["iPhone Health Shortcut"]:::ext
  gmail["Gmail<br/>(OTF emails)"]:::ext
  analytics["Vercel Web Analytics"]:::ext
  telemetry[("Pub/Sub to BigQuery")]:::store
  aigw["Vercel AI Gateway"]:::ext

  subgraph CV["Court Vision"]
    direction TB
    clientapp["Interactive Client<br/>React 19 (browser)"]:::sys
    server["Next.js Server<br/>App Router on Vercel"]:::sys
    postgres[("Supabase Postgres<br/>RLS")]:::store
    auth["Supabase Auth"]:::ext
    ingest["OTbeat Ingestion Job<br/>GitHub Actions cron"]:::batch
    importcli["Health Import CLI<br/>Node + Python"]:::batch
    panelcli["Judge-Panel CLI<br/>offline"]:::batch
  end

  visitor -->|"uses"| clientapp
  owner -->|"logs, edits"| clientapp
  applehealth -->|"on device"| shortcut
  shortcut -->|"POST + secret"| server
  applehealth -->|"health export"| importcli
  gmail -->|"emails, read daily"| ingest
  server -->|"delivers SSR / RSC"| clientapp
  clientapp -->|"admin writes + check"| server
  clientapp -->|"reads (anon, RLS)"| postgres
  server -->|"reads + writes (service-role)"| postgres
  ingest -->|"upserts otf_sessions"| postgres
  importcli -->|"writes cardio tables"| postgres
  server -->|"magic-link / session"| auth
  clientapp -->|"page metrics"| analytics
  server -->|"events & metrics"| telemetry
  panelcli -->|"generates verdicts"| aigw
  panelcli -.->|"bakes result"| clientapp

  classDef person fill:#201b16,stroke:#000000,color:#f5efe1;
  classDef sys fill:#ea580c,stroke:#7c2d12,color:#ffffff;
  classDef batch fill:#f6edda,stroke:#a9791f,color:#4a3617,stroke-dasharray:5 3;
  classDef ext fill:#efe7d6,stroke:#8a5a2b,color:#2a2018;
  classDef store fill:#e9f5ef,stroke:#2f855a,color:#173d2b;
```

| Container | Tech | Responsibility |
|---|---|---|
| **Interactive Client** | React 19 (browser) | The SVG "arena" UI and the fitness dashboards. Reads dashboard data straight from Supabase via the anon key (RLS‑limited); calls the server only for admin writes and the admin‑status probe. |
| **Next.js Server** | Next.js 15 App Router on Vercel | SSR/RSC rendering, the `/api/admin/*` write endpoints, magic‑link auth (`/auth/*`), the token‑authed `/api/health/auto-sync` ingest, and the telemetry wrapper. |
| **Application Database** | Supabase Postgres (RLS) | All persistent data. RLS grants `SELECT` to anon/authenticated; every mutation requires the service‑role key. |
| **Auth** | Supabase Auth (managed) | Passwordless magic‑link (PKCE); session stored in cookies via `@supabase/ssr`. |
| **OTbeat Ingestion Job** | Node on GitHub Actions | Daily cron: reads OrangeTheory emails from Gmail, parses HTML, classifies anomaly + class‑type, append‑upserts `otf_sessions`. |
| **Health Import CLI** | Node + Python (local) | Manual full‑archive import of an Apple Health export → cardio tables (mirror‑and‑prune). |
| **Judge‑Panel CLI** | Node + AI SDK (offline) | Runs a multi‑LLM "draft panel" and bakes a static result into the Draft Room. Not part of the request path. |

---

## 3. Components — the Web App (L3)

Zooming into the Next.js container (client + server components share a module tree in App Router).

```mermaid
flowchart TB
  visitor(["Visitor"]):::person
  owner(["Owner / Admin"]):::person
  shortcut["iPhone Shortcut"]:::ext

  subgraph UI["UI (client)"]
    direction LR
    publicui["Public Arena UI"]:::sys
    fitui["Training Facility UI<br/>(flag-gated)"]:::sys
    charts["Chart Library<br/>roughjs + d3-scale"]:::comp
    motion["Motion<br/>LazyMotion + m"]:::comp
    svg["SVG Composition"]:::comp
    flags["Feature Flags"]:::comp
  end

  subgraph DATA["Data access"]
    direction LR
    databrowser["Data Access (browser)"]:::comp
    dataserver["Data Access (server)"]:::comp
    datashared["Assemblers + Zod schemas"]:::comp
  end

  subgraph SRV["Server & platform"]
    direction LR
    api["Route Handlers<br/>app/api/**"]:::sys
    authz["Auth & Authorization"]:::comp
    supaclients["Supabase Clients<br/>anon / cookie / service-role"]:::comp
    telem["Telemetry<br/>withTelemetry"]:::comp
  end

  postgres[("Supabase Postgres")]:::store
  authsvc["Supabase Auth"]:::ext
  pubsub[("Pub/Sub to BigQuery")]:::store

  visitor --> publicui
  owner --> fitui
  shortcut -->|"POST /api/health/auto-sync"| api
  publicui --> motion
  publicui --> svg
  fitui --> charts
  fitui --> databrowser
  flags -->|"gates"| fitui
  databrowser --> datashared
  dataserver --> datashared
  databrowser --> supaclients
  dataserver --> supaclients
  api --> authz
  api --> supaclients
  api --> telem
  authz --> authsvc
  supaclients --> postgres
  telem --> pubsub

  classDef person fill:#201b16,stroke:#000000,color:#f5efe1;
  classDef sys fill:#ea580c,stroke:#7c2d12,color:#ffffff;
  classDef comp fill:#fbf8f1,stroke:#b98a3e,color:#3a2c17;
  classDef ext fill:#efe7d6,stroke:#8a5a2b,color:#2a2018;
  classDef store fill:#e9f5ef,stroke:#2f855a,color:#173d2b;
```

**UI**

- **Public Arena UI** — the interactive SVG court homepage and the themed rooms (Locker Room, Project Binder,
  Banners/The Rafters, Contact, and the Draft Room, which replays a pre‑baked panel result).
- **Training Facility UI** — the flag‑gated fitness dashboards: Gym (cardio + OTF + HR‑zone reconciliation),
  Weight Room (strength logging + trends), and Combine (movement benchmarks).

**Cross‑cutting client systems**

- **Chart Library** (`components/training-facility/shared/charts`) — a custom, hand‑drawn SVG chart kit built on
  **roughjs** + **d3‑scale** (no Recharts/Chart.js): `RoughLine` (with a dashed regression/rolling‑average
  overlay), `RoughSparkline`, `RoughBar`, `RoughScatter`, hand‑drawn axes, shared palette; all `role="img"`.
- **Motion System** — framer‑motion via the **LazyMotion + `m`** pattern (`domMax` features are code‑split out of
  the initial bundle; `strict` mode forbids the heavier `motion.*`). Honors `prefers-reduced-motion`.
- **SVG Composition** — `SvgUse`, `SafeSvgHtml` (renders HTML in `<foreignObject>` for Safari), responsive
  layout containers; content zones ship base/`Modern`/`Safari` render variants.

**Server‑side**

- **Data Access** — split by execution context into `*-server.ts` (server‑only), `*.ts` (browser), and a shared
  `*-shared.ts` pure assembler that imports **neither** Supabase client, so the two read paths can't drift.
  Rows are Zod‑validated against `lib/schemas`. A pager works around PostgREST's 1000‑row cap.
- **Supabase Clients** — three tiers = three trust levels: **browser** (anon), **server** (anon + session
  cookie), **admin** (service‑role, RLS‑bypass, `server-only`).
- **Auth & Authorization** — magic‑link login (`sendMagicLink` server action) → `/auth/callback`
  (`exchangeCodeForSession`) → cookie session. `requireAdmin()` guards API routes (401/403);
  `requireAdminPage()` guards Server‑Component pages (→ `notFound()`); both check the `ADMIN_EMAILS` allowlist.
  **There is no `middleware.ts`** — protection is per‑route in application code.
- **Telemetry** — a `withTelemetry` wrapper emits one health event per request (plus domain metrics like
  `weight_room_set_logged`) to Pub/Sub; best‑effort and PII‑guarded, `TELEMETRY_DISABLED=1` no‑ops it.

---

## 4. Data ingestion & flow

Four independent write paths land in Supabase; everything is read back out under RLS. Reads are anon
(browser **and** server); writes always use the service‑role key behind a gate (an auth check or a shared secret).

```mermaid
flowchart LR
  ah["Apple Health"]
  otfsrc["OrangeTheory"]
  shortcut["iPhone Shortcut"]
  gmail[("Gmail")]
  importcli["Health Import CLI<br/>(Node + Python, manual)"]
  autosync["auto-sync route<br/>(service-role upsert)"]
  otbeat["OTbeat Ingest Job<br/>(GitHub Actions, daily)"]
  adminapi["Admin write APIs<br/>(requireAdmin + service-role)"]
  owner["Owner / Admin"]
  pg[("Supabase Postgres")]
  dash["Dashboards<br/>Gym / Weight Room / Combine"]

  ah -->|"export zip"| importcli
  ah -->|"daily aggregates on device"| shortcut
  otfsrc -->|"per-class summary email"| gmail
  shortcut -->|"POST + secret key"| autosync
  gmail -->|"Gmail REST + OAuth"| otbeat
  owner -->|"log sets, goals, benchmarks"| adminapi
  importcli -->|"mirror + prune"| pg
  autosync -->|"upsert daily trends"| pg
  otbeat -->|"parse, classify, append-upsert"| pg
  adminapi --> pg
  pg -->|"anon RLS SELECT"| dash
```

| Path | Trigger | Source → destination | Idempotency |
|---|---|---|---|
| **Apple Health full import** | Manual CLI (`npm run import-health`) | Health export zip → Python preprocess → cardio session/HR/trend tables | Mirror‑and‑prune (deletes rows older than the batch; empty‑payload guard) |
| **Apple Health auto‑sync** | iPhone Shortcut → `POST /api/health/auto-sync` (`X-Health-Sync-Key`) | Daily aggregates → 5 lifestyle trend tables (HRV, walking‑HR, steps, sleep, active‑energy) | Upsert one row per `date` |
| **OTbeat ingest** | GitHub Actions cron `0 7 * * *` | Gmail (OTF emails) → parse/classify → `otf_sessions` | Append‑upsert, ~8‑day lookback so missed runs self‑heal |
| **Admin writes** | Owner in the UI → `/api/admin/*` | Form input → `requireAdmin` → `weight_room_*`, `movement_benchmarks` | Insert / upsert / delete |

*(Bodyweight trend is populated separately via the bodyweight‑logging flow, not the auto‑sync batch.)*

---

## 5. Data model (Supabase schema)

Every table follows the same RLS pattern — public `SELECT`, service‑role‑only writes.

```mermaid
flowchart TB
  subgraph cardio["Cardio / Gym (Apple Health)"]
    cs["cardio_sessions"]
    hrs["cardio_session_hr_samples"]
    rhr["cardio_resting_hr"]
    vo2["cardio_vo2max"]
    hrs -->|"FK cascade"| cs
  end
  subgraph life["Lifestyle Trends (date to value)"]
    hrv["cardio_hrv_trend"]
    whr["cardio_walking_hr_trend"]
    bm["cardio_body_mass_trend"]
    steps["cardio_step_count_trend"]
    sleep["cardio_sleep_trend"]
    energy["cardio_active_energy_trend"]
  end
  subgraph otf["OrangeTheory"]
    otfs["otf_sessions"]
  end
  subgraph wr["Weight Room"]
    goals["weight_room_goals"]
    sets["weight_room_sets"]
    focus["weight_room_monthly_focus"]
    sets -->|"FK cascade"| goals
    focus -->|"FK"| goals
  end
  subgraph combine["Combine"]
    mb["movement_benchmarks"]
  end
```

| Domain | Tables | Notes |
|---|---|---|
| **Cardio / Gym** | `cardio_sessions` (PK `started_at`), `cardio_session_hr_samples` (FK→sessions, cascade; ~2k samples/session), `cardio_resting_hr`, `cardio_vo2max` | Derived from Apple Health / Apple Watch. |
| **Lifestyle trends** | `cardio_{hrv,walking_hr,body_mass,step_count,sleep,active_energy}_trend` | Six identical `(date PK, value)` tables. |
| **OrangeTheory** | `otf_sessions` (PK `started_at`) | Per‑class metrics + `treadmill`/`rower` JSONB, `excluded` anomaly flag, inferred `class_type` (+ manual override). Append‑only. |
| **Weight Room** | `weight_room_goals` (PK `exercise`), `weight_room_sets` (FK→goals), `weight_room_monthly_focus` | "Grease the groove" strength logging + rotating monthly focus. |
| **Combine** | `movement_benchmarks` (PK `date`) | Athletic benchmarks. Migration applied directly to Supabase (not in `supabase/migrations/`). |

---

## 6. Key architectural decisions

| Decision | What & why |
|---|---|
| **Anon reads, gated writes** | Public dashboards read Supabase directly (anon key, RLS `SELECT`) — no bespoke read API to maintain. Writes are impossible with the anon key; they must pass through a server route holding the service‑role key. Security lives in RLS + one app‑layer gate. |
| **Three Supabase clients** | browser (anon) · server (anon + cookie) · admin (service‑role, `server-only`). The service‑role key never reaches the browser and is only reachable behind `requireAdmin` or the auto‑sync secret. |
| **`server / shared / browser` data split** | `*-shared.ts` holds the pure row→view logic and imports no client, guaranteeing the server and browser read paths produce identical shapes and neither bundle leaks into the other. |
| **Feature flags for dark launch** | `NEXT_PUBLIC_ENABLE_TRAINING_FACILITY` and `NEXT_PUBLIC_ENABLE_DRAFT_ROOM` (both default **off**) gate whole areas to 404, so in‑progress features ship to `main` without being publicly reachable. |
| **No middleware** | Route protection is per‑route (`requireAdmin` / `requireAdminPage`), keeping auth logic beside the code it protects and off the edge. |
| **Hand‑drawn chart kit** | A custom roughjs + d3‑scale SVG library instead of a charting framework — matches the sketchy "scouting report" brand and keeps the bundle lean. |
| **LazyMotion perf** | framer's `domMax` feature set is dynamically imported so animation code is code‑split out of the initial JS. |
| **Offline judge panel** | The multi‑LLM "draft panel" runs at authoring time via a CLI; the Draft Room ships a **baked** result. Zero runtime AI cost, latency, or key exposure. |
| **GitHub Actions for cron** | Scheduled ingestion runs as a GitHub Action, not a Vercel cron — no `vercel.json`. Keeps secrets and the Node+Gmail toolchain in CI. |
| **Idempotent ingestion** | Cardio import mirrors‑and‑prunes (full archive is source of truth); OTbeat append‑upserts with a wide lookback so a missed cron run self‑heals. |
| **Personal telemetry** | Server routes emit best‑effort events to a personal Pub/Sub → BigQuery pipeline for an external app‑health dashboard; disabled by an env flag. |

---

## 7. Where things live

| Concern | Path |
|---|---|
| Routes (pages, API, auth) | `app/**` |
| UI families | `components/**` (`court/`, `locker-room/`, `project-binder/`, `draft-room/`, `banners/`, `training-facility/`, `motion/`, `common/`) |
| Chart library | `components/training-facility/shared/charts/` |
| Data access | `lib/data/**` (`*-server.ts` / `*.ts` / `*-shared.ts`) |
| Supabase clients | `lib/supabase/{browser,server,admin,env}.ts` |
| Auth & allowlist | `lib/auth/**`, `app/auth/**`, `app/admin/login/` |
| Zod schemas | `lib/schemas/**` |
| Feature flags | `lib/feature-flags.ts` |
| Telemetry | `lib/telemetry/**`, `instrumentation.ts` |
| Offline judge panel | `lib/panel/**`, `scripts/panel.ts`, `app/draft-room/panelResult.ts` |
| Ingestion scripts | `scripts/*.mjs`, `scripts/lib/**` |
| DB schema | `supabase/migrations/*.sql` |
| CI + scheduled cron | `.github/workflows/**` (`otbeat-ingest.yml` is the daily cron) |

---

*Generated as a C4 architecture snapshot. Diagrams validated with the Mermaid renderer; update alongside
structural changes. See also [`design-system.md`](./design-system.md) for brand tokens.*
