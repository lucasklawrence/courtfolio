# Training Facility — PRD

**Owner:** Lucas
**Status:** Draft v4 (data-access layer, edit/delete, package recommendations)
**Last updated:** 2026-04-24
**Target repo:** `courtfolio` (single repo, absorbs `cardio-dashboard`)
**Scope:** New Training Facility zone in courtfolio containing two sub-areas — **The Gym** (cardio) and **The Combine** (movement benchmarks). Migrates existing standalone cardio-dashboard into the unified Court Vision experience.

---

## 1. Background & motivation

**Cardio side:** A working dashboard exists as a standalone HTML/JS app (`cardio-dashboard`) reading Apple Health exports. It works, but it's stylistically disconnected from `courtfolio` — Lucas's basketball-themed personal site. Two surfaces, fragmented identity.

**Movement side:** On-court basketball movement still feels clunky at ~240 lbs — slow first step, sluggish deceleration, late closeouts. Some resolves passively as bodyweight drops and aerobic engine improves. But movement quality (deceleration, lateral power, change-of-direction, first-step quickness) is a **separate trainable adaptation** that should be tracked independently from cardio progress. Otherwise it's impossible to tell whether on-court improvements come from weight loss, conditioning, or actual movement skill.

**The unification opportunity:** courtfolio already structures content as themed *places* (Locker Room, Rafters, Front Office, Film Room). Fitness data fits naturally as a new zone — **The Training Facility** — with two sub-areas:

- **The Gym** — cardio (existing dashboard's data and charts, reimagined as an interactive equipment room)
- **The Combine** — movement benchmarks (greenfield, NBA Draft Combine metaphor)

This PRD specs both sub-areas, the migration of the existing cardio-dashboard, the training program for movement, and the visualization design language.

## 2. Goals

1. **Unify** all fitness tracking into courtfolio as the Training Facility zone — single repo, single source of truth, single visual identity.
2. **Train** basketball-specific movement qualities 2×/week, low-volume, high-quality.
3. **Track** progress with 4 monthly movement benchmarks (Combine) plus existing cardio metrics (Gym), separating weight loss from athleticism gains via power-to-weight framing.
4. **Visualize** with in-world, distinctive UI — interactive gym equipment, silhouette jump trackers, court traces — not generic Chart.js views.
5. **Stay lightweight infrastructurally** — no backend, no auth, no real-time sync. Static JSON, local-dev data ingestion.

## 3. Non-goals

- Not building a workout logger for individual sets/reps inside the dashboard. Session-level notes live in Apple Notes for now.
- Not tracking heart rate during agility work — it's not the limiter for these adaptations.
- Not adding force plates, RSI, or other lab-grade metrics until tier-1 numbers plateau.
- Not building a mobile app or capturing video analysis.
- Not building a real backend / API — single repo, static data, local data entry. (See section 7 for architecture.)
- Not maintaining the standalone `cardio-dashboard` repo long-term — it gets archived once parity is achieved in courtfolio.

## 4. Core concept: power-to-weight as the lens

The single most important framing: **track raw benchmarks AND bodyweight together.** A 2-inch vertical gain at 240 lbs vs at 225 lbs tells different stories. Every benchmark chart should overlay bodyweight (or display a derived power-to-weight ratio) so the dashboard answers the real question: *am I getting more athletic, or just lighter?*

## 5. Benchmarks (Tier 1 — what to track)

Retest **monthly**. Same conditions each time: same warmup, same surface, same shoes, same time of day if possible.

| Benchmark | What it measures | Equipment | Protocol |
|---|---|---|---|
| **Bodyweight** | Denominator for everything | Scale | Morning, post-bathroom, pre-food. Average of 3 days that week. |
| **5-10-5 shuttle (pro agility)** | Change-of-direction, lateral mechanics, decel/reaccel | 3 cones, stopwatch | Cones 5 yards apart. Start at middle. Sprint 5y right, touch line, sprint 10y left, touch line, sprint 5y back through middle. Best of 3, full rest between. |
| **Vertical jump** | Lower-body power | Wall + chalk, or Vert app | Standing reach mark. Then jump-and-touch, mark highest. Difference = vert. Best of 3. |
| **10-yard sprint** | Pure acceleration | Stopwatch (or MySprint app for video timing) | From 2-point stance, no rocking start. Best of 3, full rest. |

**Why these four:** they cover the dimensions that actually limit basketball movement (acceleration, deceleration/COD, vertical power) and they're all sensitive to both weight and skill — so the divergence between them tells a useful story.

## 6. Training program

**Frequency:** 2×/week, ~20 min each, separate days from heavy stair sessions when possible.
**Equipment available:** open space, cones, resistance bands.
**Volume principle:** these are CNS-heavy. Quality > quantity. If reps slow down, stop.

### Session A — Linear & Decel focus

| Block | Drill | Sets × Reps | Rest | Cue |
|---|---|---|---|---|
| Warmup | A-skips, lateral shuffles, leg swings, 2× build-up sprints | 5 min | — | Get warm, not tired |
| Accel | 10-yard falling start sprint | 4 × 1 | 60s | Lean, don't step. Fall into the sprint. |
| Decel | 2-step decel from 15-yard sprint | 4 × 1 | 60s | Sprint hard, stop in 2 steps, hold position 1s |
| Power | Broad jump | 3 × 3 | 45s | Stick the landing. Full reset between reps. |
| Lateral | Banded lateral shuffle (10 yards each way) | 3 × 2 | 45s | Stay low, no crossover, hips square |
| Cooldown | Walk + stretch | 3 min | — | — |

### Session B — COD & Lateral Power focus

| Block | Drill | Sets × Reps | Rest | Cue |
|---|---|---|---|---|
| Warmup | Same as Session A | 5 min | — | — |
| Lateral power | Skater bounds (lateral hop, stick, hop other way) | 3 × 6 each side | 60s | Stick each landing 1s before next jump |
| COD | 5-10-5 shuttle | 4 × 1 | 90s | Drop hips at the cone. Don't round the turn. |
| Reactive | Closeout-and-recover (sprint to cone, decel to defensive stance, slide back 3 yards) | 4 × 1 | 60s | Mimic actual closeout angles |
| First step | T-drill or banded triple-threat starts | 3 × 4 | 45s | Explode off the front foot, no false step |
| Cooldown | Walk + stretch | 3 min | — | — |

### Weekly placement (example)

```text
Mon — Stairs (Z2)
Tue — Movement Session A
Wed — Run (Z2) or rest
Thu — Stairs (Z4 intervals)
Fri — Movement Session B
Sat — Pickup / open gym
Sun — Walk or rest
```

Movement sessions go on days *not* stacked behind a Z4 stair session — fresh CNS matters more than fresh legs here.

## 7. Architecture — the Training Facility

### 7.1 Zone structure in courtfolio

Add a new top-level zone: **Training Facility**. Mirrors the architectural pattern of Locker Room (a parent space containing themed sub-areas/lockers).

```text
courtfolio
├── Court (existing home)
├── Locker Room (existing)
├── Rafters (existing)
├── Front Office (existing)
├── Training Facility (NEW)
│   ├── The Gym (cardio — migrated from cardio-dashboard)
│   ├── The Combine (movement benchmarks — greenfield)
│   └── The Weight Room (bodyweight grease-the-groove — roadmap, post-v1)
├── Film Room (roadmap)
├── Hall of Strategy (roadmap)
└── Press Room (roadmap)
```

Entry point on the main court: a doorway/tunnel labeled **Training Facility** somewhere on the existing court SVG (location TBD — likely near the baseline or behind the bench, away from the existing locker room and front office). Tap → enters the Training Facility, which itself has two sub-doors: Gym and Combine. Doors visually communicate what's inside (a stair climber visible through the Gym door; cones and a stopwatch through the Combine door).

### 7.2 Single-repo architecture

**Decision: fold cardio-dashboard's functionality into courtfolio.** No separate API, no separate repo, no separate deploy. One codebase, one source of truth.

Rationale:
- Single user, single audience — splitting into "data API" + "presentation layer" is over-engineering for the actual use case.
- courtfolio already has the right stack (Next.js, TypeScript, Tailwind, Framer Motion, custom SVGs) for the visualizations.
- Eliminates CORS, deploy coordination, and version-skew concerns.
- The existing `cardio-dashboard` repo can be archived for historical reference once parity is achieved.

**What moves where:**

| From `cardio-dashboard` | To `courtfolio` location | Notes |
|---|---|---|
| `preprocess_health.py` | `scripts/preprocess-health.py` | Run locally to convert Apple Health export → JSON |
| `cardio.json` (preprocessed output) | `public/data/cardio.json` | Static asset, fetched at runtime |
| `health-dashboard.html` charts | `components/training-facility/gym/*.tsx` | Rebuilt as React components |
| Tab structure (All / Stair / Running / Walking) | Sub-views within the Gym scene | See 7.4 |
| Date filter (1M, 3M, 6M, 1Y, All) | Shared component, reused in Combine | |
| HR zone config | Shared config module — used by Gym and Combine equally | Honors the existing roadmap commitment to configurable zones |

### 7.3 Data architecture (no backend)

All data lives as static JSON in `public/data/`:

```text
courtfolio/public/data/
├── cardio.json              # output of preprocess-health.py
└── movement_benchmarks.json # written by Combine entry form (local-dev only)
```

**Cardio data flow:**
1. Lucas exports Apple Health from his iPhone, drops the ZIP somewhere on his dev machine.
2. Runs `npm run import-health -- path/to/export.zip` (a script that wraps `preprocess-health.py`).
3. Script writes updated `public/data/cardio.json`.
4. Lucas commits the JSON, pushes, deploy auto-rebuilds.

Frequency: every few weeks, manually. No automation needed.

**Combine data flow:**
1. Lucas finishes a benchmark session, opens courtfolio locally (`npm run dev`).
2. Navigates to Training Facility → Combine, fills in the entry form, submits.
3. Form writes (via a local-dev-only Next.js API route) directly to `public/data/movement_benchmarks.json` on the filesystem.
4. Lucas commits the JSON, pushes, deploy auto-rebuilds.

**Why local-dev entry only (not production form submission):**
- Avoids needing a real backend, auth, or a serverless function.
- Avoids the security risk of exposing a write endpoint on a public site.
- Monthly cadence makes the "spin up dev server to log a session" overhead trivial (~30 seconds).
- Production site stays purely static — fast, cheap, no runtime dependencies.

The Next.js API route enabling local writes is gated behind `process.env.NODE_ENV === 'development'` and returns 404 in production builds. Belt and suspenders.

**Tradeoff acknowledged:** can't enter benchmarks from a phone immediately after a session. Workaround if needed: jot it in Apple Notes, transcribe later when at the dev machine. If this becomes annoying, fallback option is localStorage-based entry on the production site with a manual export-and-commit step (specced in section 11 as a future option).

### 7.4 The Gym — sub-area spec

Interactive equipment-room scene, parallel in ambition to the Locker Room.

**Scene layout (SVG):**
- Side-on view of a gym interior.
- **Stair climber** (front-and-center, since it's the primary modality): clickable → opens Stair Climber detail view.
- **Treadmill**: clickable → opens Running detail view.
- **Track** (running around the back wall, or a small indoor track silhouette): clickable → opens Walking detail view.
- **Heart-rate monitor display** on the wall: shows current resting HR with a small trend sparkline. Pulses subtly at the displayed BPM.
- **Whiteboard** on the wall: shows latest VO2max value + trend. Hand-drawn chart in Patrick Hand.
- **Wall scoreboard**: this week's totals (sessions completed, total time, total distance). Reuses the Scoreboard component from the Combine (see 9.1).
- **Tablet / clipboard on a bench**: tap to trigger Apple Health re-import flow (in dev) or just shows last-import date (in production).
- **Door at the back**: leads to the Combine. Visual continuity between sub-areas.

**Detail views (per equipment piece):**
When a piece of equipment is tapped, the gym scene zooms/transitions to a detail view for that activity. Each detail view contains the existing cardio-dashboard charts for that activity, restyled in courtfolio's visual language:

- HR zone distribution bars
- Per-session avg HR bar chart
- Pace trend line (running, walking)
- Cardiac efficiency (meters per heartbeat) chart
- Pace-at-HR scatter plot
- Session log table

These charts ship as React components using a chart library that supports custom SVG styling (recharts is in the stack via courtfolio's existing options; or custom D3/SVG for tighter visual control). Final library choice is an implementation detail — must support hand-drawn aesthetic, not default to slick-modern.

**"All Cardio" overview:**
A toggle or alternate scene view that shows all activities aggregated — same chart set as the existing dashboard's "All Cardio" tab. Could be styled as a "stats wall" or coach's clipboard view.

### 7.5 The Combine — sub-area spec

Greenfield. NBA Draft Combine metaphor — the place where measurables are taken.

**Scene framing:**
A staging area, less equipment-dense than the Gym. Could be styled as:
- An indoor gym floor with measuring tape, cones, and a vertical-jump station (e.g., a Vertec-style apparatus).
- Or a stripped-down "testing area" — clipboard with stat lines, a stopwatch, a scale.

The Combine scene is dominated by the *visualizations*, not by interactive equipment. Whereas the Gym is "tap a thing to see its data," the Combine is more like a results-display room — the seven visualizations from Section 9 are the content.

**Page structure (vertical scroll):**
1. Scoreboard summary header (9.1)
2. Trading card stat block (9.2)
3. Silhouette jump tracker (9.3) + Ceiling view (9.4) — paired side-by-side on desktop, stacked on mobile
4. Shuttle trace on the court (9.5)
5. Sprint race vs past selves (9.6)
6. Radar (9.7)
7. Entry form (collapsible "Log a session" panel — only visible/functional in dev)
8. Full benchmark history table (sortable, secondary)

### 7.6 Movement benchmark JSON schema

```json
[
  {
    "id": "bmk_2026-04-24_01",
    "date": "2026-04-24",
    "bodyweight_lbs": 240.5,
    "shuttle_5_10_5_s": 5.42,
    "vertical_in": 22.0,
    "sprint_10y_s": 1.91,
    "notes": "First baseline. Felt sluggish on the second 5-10-5."
  }
]
```

All fields optional except `id` and `date` — supports partial entries (e.g., bodyweight-only weeks). `id` is the canonical write/update/delete key (date alone is brittle: retests, corrections, or import variance can produce two entries with the same date). Suggested format: `bmk_<YYYY-MM-DD>_<seq>`, generated client-side at log time.

### 7.7 Configurability hook

Benchmark definitions (name, units, direction-of-improvement, target ranges) live in a config object, not hardcoded into chart logic:

```ts
// constants/benchmarks.ts
export const BENCHMARKS = {
  shuttle_5_10_5_s: {
    label: '5-10-5 Shuttle',
    unit: 's',
    direction: 'lower',    // lower is better
    targetRange: [4.5, 6.0],
  },
  vertical_in: { ... },
  sprint_10y_s: { ... },
  bodyweight_lbs: { ... },
};
```

Same pattern applies to HR zones (already on the roadmap). All visualizations read from these configs — adding/modifying a benchmark is a config change, not a chart rewrite.

### 7.8 Shared components (built once, used by both sub-areas)

Identifying these upfront enables the parallel build approach:

- **Scoreboard** — split-flap digit display. Used as Combine summary header AND Gym wall scoreboard.
- **Trading card** — flippable card component. Used as Combine stat block; future use for cardio "session of the week" cards.
- **Date filter** — 1M / 3M / 6M / 1Y / All preset bar plus custom range. Reused across all detail views.
- **Hand-drawn chart primitives** — line, bar, scatter, with Patrick Hand annotations. Used everywhere.
- **Court SVG** — half-court rendering. Used in Combine shuttle trace; could be reused for future basketball-specific viz.
- **Bodyweight overlay** — given any time-series chart, overlays bodyweight as a secondary axis. Used across both sub-areas.

Build these in `components/training-facility/shared/` from day one.

### 7.9 Power-to-weight derived metrics (v2, not v1)

Future addition: a derived "movement quality index" that normalizes benchmarks against bodyweight (e.g., vertical × bodyweight = approximate power output). Not in v1 scope — first ship the raw benchmarks and bodyweight overlay, then see what story the data tells before adding derivations.

### 7.10 Data-access layer (forward-looking architecture)

Even though the v1 architecture is "single repo, static JSON, no backend," every component reads data through an abstraction layer rather than touching the JSON files directly. This is the single most important architectural commitment in the PRD because it makes a future API migration nearly free.

**The pattern:**

```ts
// lib/data/cardio.ts
export async function getCardioData(): Promise<CardioData> {
  const res = await fetch('/data/cardio.json');
  if (!res.ok) throw new Error('Failed to load cardio data');
  return res.json();
}

// lib/data/movement.ts
export async function getMovementBenchmarks(): Promise<Benchmark[]> { ... }
export async function logBenchmark(entry: Benchmark): Promise<void> { ... }
export async function updateBenchmark(id: string, updates: Partial<Benchmark>): Promise<void> { ... }
export async function deleteBenchmark(id: string): Promise<void> { ... }
```

**Rules of the road:**
1. **No direct JSON imports in components.** A chart component must never `import data from '../public/data/cardio.json'`. It calls `getCardioData()`.
2. **All writes go through the layer.** The Combine entry form calls `logBenchmark(entry)`, which today POSTs to a local-dev API route, tomorrow could POST to a real backend — the form doesn't know or care.
3. **One module per data domain.** `lib/data/cardio.ts`, `lib/data/movement.ts`, future `lib/data/sessions.ts`. Each module owns its read/write functions.
4. **Types are shared.** `types/cardio.ts`, `types/movement.ts`. Same types used by the Python preprocessor's output, the static JSON, the data-access layer, and any future API response. Single source of truth for schema.

**Why this matters:** a future migration to a real API is a one-line diff per data-access function (change the URL). Components, charts, forms, and visualizations don't change. If the API ever ships, the only files that touch the migration are inside `lib/data/`.

**What this does NOT pre-build:**
- Authentication (no users yet)
- Multi-tenancy (no other-user data isolation)
- Real-time sync (no live updates)

These are product pivots, not refactors — see 7.13.

### 7.11 Entry editing — edit and delete benchmarks

Even in single-user mode, users (Lucas) need to fix mistakes. Typos happen. Sometimes a benchmark session ended early and the entry should be removed. Build these as first-class operations from v1, not as an afterthought.

**Capabilities:**
- **Edit:** open the same entry form, prefilled with the existing values for that date. Submit overwrites the entry.
- **Delete:** confirmation dialog ("Delete benchmark from 2026-04-24? This cannot be undone."), then removes the entry from the JSON.
- **Mark as test/incomplete:** optional `isComplete: false` flag on an entry. Excluded from trend calculations and visualizations but kept in the history table for reference. Useful when a session was cut short or the user wasn't fully warmed up.

**Where the controls live:**
- Inline edit/delete buttons on each row of the benchmark history table (Combine, section 7.5 view 8).
- Tap edit → entry form modal opens prefilled.
- Tap delete → confirmation modal.

**Data layer:** `updateBenchmark()` and `deleteBenchmark()` in `lib/data/movement.ts` (per 7.10). Both are dev-only writes via the same Next.js API route gated behind `NODE_ENV === 'development'`, same as `logBenchmark()`.

**Cardio data parity:** the Python preprocessor is the source of truth for cardio data — re-running it produces a fresh `cardio.json`. Editing individual cardio entries isn't supported in v1 (you'd re-export Apple Health and re-process). If a workout was logged incorrectly in HealthKit itself, fix it there and re-import. Adding edit-cardio capability is post-v1.

### 7.12 Admin section — what's needed (and not) at each stage

Worth being explicit about what "admin" means at different stages of the project's life, because the term gets overloaded.

**Stage 1: Single-user (v1, today's plan)**
- No admin section needed.
- "Admin" is the dev machine + Git.
- The local-dev entry form, the `npm run import-health` script, and Git commits are the admin interface.
- The edit/delete controls in 7.11 are user functionality, not admin functionality, even though the only user is Lucas.

**Stage 2: Single-user with quality-of-life polish (v1.x)**
Nice-to-have additions, all still single-user:
- An "Edit benchmark" affordance on each history row (specced in 7.11).
- A simple "last imported" timestamp visible in the Gym (when was Apple Health last synced).
- A "session adherence" log if/when training-day tracking is added.

None of these require auth or a real admin layer.

**Stage 3: Multi-tenant (hypothetical future)**
This is a *product pivot*, not a refactor. If Lucas ever wants others to use the Training Facility, the work splits into two categories:

*User-facing functionality (per-user):*
- Authentication: sign up, sign in, sessions
- Per-user data isolation: my benchmarks ≠ your benchmarks
- Per-user Apple Health import flow (no longer "Lucas runs a Python script")
- Privacy settings per user (public profile, friends-only, fully private)
- Profile data: name, height (for silhouette accuracy), starting baseline

*Operator admin (just for Lucas):*
- A `/admin` route gated by a hardcoded admin email/role
- See all users, basic usage stats
- Moderate or delete inappropriate user content (notes are free text)
- Feature flags for testing new visualizations
- Backup/export tooling
- User-level debugging support

The operator admin layer is small. The user-facing functionality is the bulk of the work. Neither should be pre-built today.

### 7.13 Future migration notes

Documenting this so future-Lucas (or any collaborator) knows the constraints and the path forward.

**What's already migration-ready (because of 7.10):**
- Swapping static JSON for a real API: change URLs in `lib/data/*.ts`. No component changes.
- Adding new data domains: create a new module in `lib/data/`, share types via `types/`. Existing modules unaffected.
- Replacing the local-dev write API route with a hosted backend endpoint: same path, same payload contract. Form code unchanged.

**What requires real product decisions if multi-tenancy ever happens:**
- Auth provider (NextAuth, Clerk, Supabase Auth, Auth.js, etc.) — implementation detail, but the choice affects the UX a lot.
- Database (Postgres, SQLite via Turso, Supabase, etc.). Static JSON doesn't scale to multi-user.
- Privacy model (who can see whose data? Default public, default private, granular?).
- Onboarding (height, baseline, goals — where does this come from?).
- Apple Health import flow without Lucas's laptop (mobile import? Health Auto Export app + webhook? Manual file upload?).
- Pricing/cost model (if it becomes a product) — none of the architecture decisions today should foreclose future monetization, but no work goes toward it now.

**Architectural commitments to preserve the option:**
- Keep the data-access layer pure (7.10).
- Keep types shared (7.10).
- Keep visualizations data-shape-driven, not user-identity-driven. A silhouette tracker takes an array of jump entries; it should not assume those entries belong to "Lucas."
- Don't bake personal info (name, photos) into shared components. Personalize via props from a user-level config.
- Use environment variables for any data URLs (`NEXT_PUBLIC_DATA_URL` defaulting to `/data`) so the source can be swapped without code changes.

These cost essentially nothing today and keep every door open.

### 7.14 Recommended packages

Based on research into the React + Next.js ecosystem in 2026 and what fits courtfolio's existing stack and aesthetic:

**Already in courtfolio's stack (keep using):**
- **Next.js + TypeScript + Tailwind** — foundation, no change.
- **Framer Motion (now "Motion")** — declarative animations with gestures and scroll support, dominant React animation library. Already used for courtfolio's locker-room and tour animations. Use for: scoreboard digit flips, card hovers/flips, silhouette jump arcs, page transitions between sub-areas.
- **shadcn/ui** — already used for select components. Use for: form inputs, modals (edit/delete confirmation), tooltips. shadcn/ui form components use RHF out of the box — natural pairing.
- **Custom SVGs** — for all the in-world scenes (Gym, Combine, equipment, court).

**New additions recommended:**

1. **`rough.js`** — for the hand-drawn aesthetic. Rough.js is a small (<9kB gzipped) graphics library that lets you draw in a sketchy, hand-drawn-like, style. The library defines primitives to draw lines, curves, arcs, polygons, circles, and ellipses. It also supports drawing SVG paths. Rough.js works with both Canvas and SVG. This is the perfect aesthetic match for the Patrick Hand-driven, sketchy courtfolio look. Use for: chart axes, bar fills with hatching, the silhouette outline, court lines on the shuttle trace, the reach-gauge bar in the ceiling view. Tiny dependency. Custom-build chart primitives on top of it.

2. **`recharts` OR custom-built charts on top of `rough.js` + `d3-scale`** — chart library decision. Two viable paths:
   - **Recharts** for the standard Gym detail views (HR zone bars, pace trends, session log charts). Recharts is a redefined chart library built with D3 and React. One of the most popular charting libraries for React, Recharts has excellent documentation and is already familiar in many React stacks. Restyle outputs with rough.js post-render or with custom SVG overlays. Faster to ship.
   - **Custom on `rough.js` + `d3-scale`** for the signature Combine visualizations (silhouette tracker, ceiling view, shuttle trace, sprint race) — recharts can't do these. They're essentially custom SVG scenes, not charts.
   - **Recommendation:** use *both*. Recharts for "boring" charts, fully custom SVG (with rough.js primitives + d3-scale for math) for the signature visualizations. Don't try to make recharts produce a hand-drawn silhouette.

3. **`react-hook-form` + `zod`** — for the Combine entry form. React Hook Form remains the default choice for most React applications in 2026 — battle-tested, performant, great ecosystem, and works well with React 19 server actions. The combination of React Hook Form with Zod provides end-to-end type safety from schema definition to form submission, making runtime type errors nearly impossible. Zod schemas double as the validation layer for the dev-only API route AND the type definition for benchmark entries — single source of truth.

4. **`d3-scale`** (just the scale module, not full d3) — for axis math, time scales, linear scales, in custom visualizations. Tree-shakeable, small, unavoidable for any custom chart work.

5. **No new state management library** — React's built-in `useState` and `useReducer` are sufficient. The data-access layer (7.10) handles fetching. If global state ever becomes necessary, defer the decision until then.

6. **No analytics, no tracking, no monitoring** for v1. Skip Sentry, PostHog, etc. Single user, low traffic, no data to act on.

**Explicitly considered and rejected:**
- **GSAP** — GSAP is a framework-agnostic JavaScript animation library that's powerful, but Framer Motion is already in the stack and covers the needs. Adding GSAP would mean two animation libraries; not worth it.
- **roughViz** — JavaScript-only, no TypeScript support, last meaningful update was years ago. Use raw `rough.js` instead — same aesthetic, more flexibility, better maintained.
- **Visx** — low-level D3 primitives wrapped in React, leaving styling and layout entirely in your hands. Powerful but heavy for what's needed. Custom SVG with d3-scale for the bespoke viz, recharts for the standard viz, is a simpler split.
- **Nivo / Victory / ECharts** — too opinionated visually. Hard to make them look hand-drawn without fighting them. Recharts is more easily restylable.
- **Formik** — Formik is not actively maintained at the moment. React Hook Form is the clear current default.
- **Auth/database packages** (NextAuth, Supabase, etc.) — not needed for single-user. Defer until Stage 3 (multi-tenant), if it ever happens.

**Total new dependency footprint:** ~5 packages (rough.js, recharts, react-hook-form, zod, d3-scale). All are small, well-maintained, and TypeScript-friendly.

## 8. Visualizations — design language

The Movement tab should feel like it belongs to the **Court Vision** universe, not a generic Chart.js dashboard. Inheriting from the `courtfolio` repo:

**Design tokens to reuse:**
- **Typography:** `Patrick Hand` for all in-world text (numbers on jerseys, scoreboard digits, scouting-report annotations). System sans-serif for UI chrome (form labels, helper text).
- **Visual style:** SVG-first, hand-drawn feel. No glossy gradients, no shadcn-default pill buttons in the hero visualizations. Slight rotation/wobble on elements is *good* — matches the existing locker-room and rafters aesthetic.
- **Motion:** Framer Motion springs (already in stack). Animations should feel physical, not eased — basketballs bounce, jerseys sway, jumps decelerate at apex with a real gravity arc.
- **Metaphor density:** every visualization is a *place or object* in the basketball world. Not "a chart of vertical jump" but "a player jumping toward a rim."
- **Color:** courtfolio doesn't define a palette in Tailwind config — colors live per-component. The Movement tab should pick a tight palette (hardwood tan, court-line cream, rim-orange, ink-black) and apply it consistently. No neon, no Chart.js defaults.
- **Mobile-first:** zoom/pan support, orientation-aware. Same constraints as the rest of the site.

**Naming:** lean into the metaphor. Don't call it "Movement Tracking Tab" — call it something like **"The Combine"** (NBA Draft Combine is the canonical place where vertical, sprint, and shuttle are tested). This fits the `courtfolio` zone-naming pattern (Locker Room, Rafters, Front Office, Film Room).

## 9. Visualizations — the seven views

Each visualization below is a v1 must-have. They sit on a single Combine page, in this rough vertical order: Scoreboard at top → Trading Card → Silhouette + Ceiling (paired) → Shuttle Trace → Sprint Race → Radar.

### 9.1 Scoreboard summary header

**What it is:** Arena-style scoreboard at the top of the Combine page, displaying latest values and deltas vs. baseline (first entry).

**Layout:** Horizontal bar styled as an old-school dot-matrix or LED scoreboard. Four cells: Bodyweight | 5-10-5 | Vertical | 10y Sprint. Each cell shows the latest value in large scoreboard digits, with a small delta below (`Δ −0.18s` in green for improvement, red for regression).

**Animation:** On page load, digits flip into place one cell at a time (split-flap style). Delta values count up from zero.

**Data binding:** Latest entry from `movement_benchmarks.json` vs. earliest entry. Direction of "improvement" defined per-benchmark in the config object.

**Cheesy in a good way:** absolutely. Lean in.

### 9.2 Trading card stat block

**What it is:** A Panini/NBA 2K-style trading card displaying current stats. Fits the existing courtfolio "binder with trading cards" pattern (v0.2.0 of courtfolio uses this for projects already — reuse the component if possible).

**Layout:** Card-sized SVG (roughly 2.5:3.5 aspect ratio). Top: silhouette portrait or jersey number. Middle: stat lines styled like a basketball card back — VERT, 5-10-5, 10Y, WT. Bottom: a "season" label ("2026 Spring") and a small star/badge for any current personal best.

**Interaction:** Tap/click to flip the card and reveal the back: full benchmark history as a mini stat table, plus the latest notes field.

**Animation:** Card has a subtle hover wobble (Framer Motion spring). Flip animation on click. Personal-best badge pulses gently.

**Data binding:** Latest entry. PB detection: compare each metric against all prior entries.

### 9.3 Silhouette jump tracker — *the signature visualization*

**What it is:** Side-profile silhouette of a basketball player (Lucas-shaped if we want to commission a custom SVG; generic otherwise) with a stack of frozen jump silhouettes representing each monthly benchmark.

**Layout:**
- Ground line at the bottom.
- Standing silhouette anchored to the ground.
- Dashed horizontal line marking standing reach (= height + arm reach).
- Above the standing reach line, every benchmarked vertical jump is rendered as a translucent silhouette frozen at peak height (silhouette feet positioned at jump height above ground).
- Latest jump: solid, full-color (rim-orange), labeled with date and inches.
- Older jumps: progressively faded toward grey/cream.
- Y-axis on the right: inches above standing reach, with tick marks every 6 inches.

**Animation on load:** standing silhouette crouches into a quarter-squat, explodes upward with a real parabolic arc, freezes at the latest jump height. Older jumps fade in afterward, lowest-to-highest.

**Hover/tap on a frozen silhouette:** tooltip shows date, vertical inches, bodyweight that month.

**Why this is the signature view:** vertical jump is inherently spatial. A line chart of "inches over time" throws away the spatial dimension that makes the benchmark *matter*. This view preserves it — you see height *as* height, and you see the stack growing.

### 9.4 Ceiling / rim view

**What it is:** Pairs with the silhouette tracker. A rendered basketball hoop (rim at 10 feet, backboard, net) with a vertical "reach gauge" showing how close current jump-touch reach is to the rim.

**Layout:**
- Right-side panel next to or below the silhouette tracker.
- Full backboard + rim + net rendered in SVG, hand-drawn style.
- A vertical bar (court-line cream on hardwood tan) extends from the floor up to the user's current jump-touch height (= standing reach + vertical jump).
- The gap between the top of the bar and the rim is annotated: "X inches to rim."
- Each month, the bar extends a little higher; faint tick marks show prior months' tops.

**Milestone moment:** if/when jump-touch reaches 120" (rim height), trigger a celebration animation — net swish, confetti, the works. This is a real, tangible long-term goal that this view makes legible.

**Why it works:** "I jumped 22 inches" is abstract. "I'm 14 inches from touching rim" is a felt distance. Same data, different frame, far more motivating.

### 9.5 Shuttle trace on the court

**What it is:** Top-down basketball court view with the 5-10-5 shuttle drawn as an animated path. Each month's run is a separate trace; latest is solid, prior months are ghost trails.

**Layout:**
- Half-court SVG (matches courtfolio's existing court rendering language). Hardwood texture, free-throw line, three-point arc, etc.
- Three cones placed in a line near the top of the key (5 yards apart, at the appropriate scale).
- Path traced from start cone → right cone (5y) → far-left cone (10y) → start cone (5y back).
- Latest run animates at real-time speed (e.g., a 5.42s run animates over 5.42s). Glowing rim-orange trail.
- Prior runs render as faded ghost trails behind, each running simultaneously.

**The "race the past" moment:** when all traces start together, the latest run finishes while older/slower runs are still mid-shuttle. That visual gap *is* the improvement.

**Interaction:** "Replay" button to re-run the animation. Toggle to show/hide individual months.

### 9.6 Sprint race vs past selves

**What it is:** A 10-yard horizontal strip with multiple dots racing across — one per benchmark entry — at their respective real-time speeds.

**Layout:**
- Horizontal strip styled as a basketball court sideline or a sprint lane. 10-yard distance marked with tick marks every yard.
- Each entry = one dot in a horizontal lane (stacked vertically). Latest entry's lane on top.
- Each dot animated at its real time (a 1.91s sprint moves the dot across in 1.91 seconds).
- Time stamps appear next to each dot when it crosses the finish line.

**Visual gimmick:** the fastest dot pulls ahead and finishes first, even though all dots started together. You're literally watching yourself outrun your past self.

**Interaction:** "Race" button to restart. Hover on a lane shows date and time.

### 9.7 Radar — the athletic shape

**What it is:** Four-axis radar chart where the shape grows outward as benchmarks improve. Acts as a "summary glance" view alongside the scoreboard.

**Axes:** 5-10-5 (inverted so faster = further out), Vertical, 10y sprint (inverted), Bodyweight (inverted, i.e., lighter = further out).

**Layout:**
- Hand-drawn-feeling polygon, not a slick recharts default.
- Latest entry as solid filled shape (rim-orange, 30% opacity).
- Earliest entry as a dashed outline behind it (court-line cream).
- Optionally: each month as a faded outline, animated transitions between them with a "scrubber" timeline below.

**Why it's worth including:** the radar is the only view that shows *all four benchmarks at once*. Visually, you watch the shape *expand* over time — a more abstract but viscerally satisfying summary.

### 9.8 Phasing recommendation

The architecture decision (single repo, parallel build, shared components) shapes the phasing. The seven Combine visualizations don't ship in isolation — they ship alongside Gym migration work, sharing components.

**Phase 0 — Foundation (week 1)**
Build the shared components (section 7.8) before either sub-area:
- Scoreboard component
- Trading card component
- Date filter (with presets)
- Hand-drawn chart primitives (line, bar)
- Bodyweight overlay utility
- Benchmark/zone config modules
- `public/data/cardio.json` migrated from existing dashboard
- Local-dev API route for Combine entry form
- `npm run import-health` script wrapping the Python preprocessor

Also: take a baseline Combine benchmark session so there's real data to render.

**Phase 1 — Training Facility shell + entry points (week 2)**
- New courtfolio route/zone for Training Facility
- Door/tunnel from main court into Training Facility
- Two doors inside: Gym and Combine
- Gym scene SVG (equipment placement, no detail views yet)
- Combine scene SVG (staging area, no visualizations yet)
- Both sub-areas reachable, both empty inside

**Phase 2 — First-pass functional (weeks 3–4)**
Ship something useful in both sub-areas, even if not fully realized:
- **Gym:** stair climber tile is clickable → opens detail view with HR zones, per-session HR, session log table. Other equipment renders but is not yet clickable.
- **Combine:** Scoreboard (9.1) + Trading Card (9.2) + entry form. Real data populates them.

By end of Phase 2, both sub-areas have a working v0.5.

**Phase 3 — Signature visualizations (weeks 5–7)**
The work that defines the project's identity:
- Silhouette jump tracker (9.3) + Ceiling view (9.4) — paired build, biggest single chunk of work
- Treadmill detail view (running charts) in Gym
- Track detail view (walking charts) in Gym
- Heart-rate monitor wall display, VO2max whiteboard, wall scoreboard

**Phase 4 — Motion-heavy visualizations (weeks 8–9)**
- Shuttle trace on the court (9.5)
- Sprint race vs past selves (9.6)
- All Cardio overview / stats wall

**Phase 5 — Polish + retire old dashboard (week 10)**
- Radar (9.7)
- Cross-link from Gym to Combine and vice versa
- Achieve parity with existing cardio-dashboard, archive that repo
- Roadmap entry to Rafters or changelog: "v0.3.0 — Training Facility"

Timeline is rough — assumes part-time work, not a full-time push. Phases can compress or overlap; what matters is the dependency order (shared components first, scenes before details, foundation before signature).

## 10. Success criteria

**Foundation (end of Phase 2):**
- Training Facility zone exists, reachable from main court, both sub-areas accessible.
- Cardio data renders inside the Gym with at least one detail view (stair climber).
- Combine has scoreboard + trading card + entry form + edit/delete controls with at least one real benchmark logged.
- All data reads/writes go through the `lib/data/` access layer (7.10) — no direct JSON imports in components.
- `cardio-dashboard` repo can be put into "frozen" state (no new development).

**Full v1 (end of Phase 5):**
- All seven Combine visualizations shipped.
- All three Gym equipment detail views (stair, treadmill, track) plus All Cardio overview shipped.
- Wall scoreboard, HR monitor, VO2max whiteboard rendering live data.
- Edit/delete/mark-incomplete fully functional on all benchmark entries.
- Hand-drawn aesthetic consistent across all visualizations (rough.js primitives applied throughout).
- Standalone `cardio-dashboard` repo archived; courtfolio is the only home for fitness data.

**3 months after v1 ships:**
- At least 3 monthly Combine benchmark entries logged. Movement sessions averaging ≥1.5×/week.
- Measurable improvement in at least 2 of 4 movement benchmarks beyond what bodyweight loss alone explains. (Specifically: shuttle and sprint times improving by more than the percentage drop in bodyweight.)
- Subjective: on-court "clunky" feeling reduced — captured in the optional notes field over time.
- The Training Facility feels like part of the courtfolio universe, not a tacked-on dashboard.

## 11. Open questions

1. **Custom silhouette SVG**: commission/draw a Lucas-shaped silhouette, or use a generic basketball-player silhouette? Custom is more personal but adds scope. Lean: generic for v1, swap for custom later.
2. **Vert app vs wall-and-chalk** for vertical jump measurement: which is more reliable? Worth a one-time comparison test before settling on the protocol.
3. **Where is the Training Facility entry on the main court?** Existing court SVG has the Locker Room, Rafters door, and Front Office already placed. Adding a Training Facility door requires deciding spatial placement — visually balanced with existing zones, narratively coherent.
4. **Mobile-only entry fallback**: if the local-dev-only entry form becomes painful (forgetting to log, no laptop after pickup), is a localStorage-based mobile entry mode worth the complexity? Form writes to localStorage in production, "Export" button generates a JSON diff to commit. Defer until pain shows up.
5. **Apple Health re-import UX**: how often does the import need to run? Once a month? Should there be an in-Gym "last synced" indicator? Probably yes — small detail but reinforces the "real data" feel of the room.
6. **Session adherence tracking**: a binary "did the session" log per training day. Could power a streak counter or a "this week" indicator on the Gym wall scoreboard. Defer to v1.1, but the data model should support it (a `sessions.json` sibling to `movement_benchmarks.json`).
7. **Visitor experience**: courtfolio is a public portfolio. Do visitors *also* see the Training Facility, or is it hidden / behind a "personal" toggle? Lean: fully public — the unusual personal-data use case is part of what makes the site distinctive. But bodyweight numbers are exposed, which is a personal call.
8. **Chart library**: recharts (already an option in courtfolio's stack) or custom D3/SVG for tighter visual control? Implementation detail to decide during Phase 0. Custom likely needed for the signature visualizations (silhouette, court trace) but recharts may be fine for the standard Gym detail charts.

## 12. Out of scope (explicit)

- Programmed lifting (squats, deadlifts, set/rep schemes) — separate concern, not tracked here. Bodyweight grease-the-groove (pushups, pullups, dips) is *in* scope as a future Weight Room sub-area of Training Facility — see 7.1 — but post-v1.
- Sport-specific skill work (shooting, ball handling) — separate concern.
- Nutrition/recovery tracking.
- Comparing against population norms or age-graded standards — the only baseline that matters is Lucas's own first entry.
