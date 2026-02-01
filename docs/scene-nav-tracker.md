# Scene Navigation Implementation Tracker

- **Owner:** Codex
- **Today:** February 1, 2026
- **Source:** scene_based_navigation_prd_implementation_plan.md

## Legend
- [ ] Not started
- [~] In progress
- [x] Done

## Tasks
- [x] Create tracker and confirm scope (this file).
- [x] Prep & inventory: map existing routes to target scene IDs and note required assets/props.
- [x] Core infrastructure: add `SceneTypes`, `SceneProvider`, motion tokens, and Arena shell scaffolding.
- [x] Camera system: implement `CameraWrapper` and camera presets (desktop/mobile, reduced motion).
- [x] Scene rendering: `SceneRenderer` and initial `CourtScene` extraction.
- [x] Routing & URL sync: shared layout that mounts shell, slug route that drives `goToScene`, back/forward handling.
- [x] Incremental migration: move Locker Room, Rafters, Film Room, Front Office/Projects, Contact into scenes (Film/Rafters currently placeholders).
- [ ] UX persistence: lift tutorial/ambience state, reduced-motion branch, analytics hooks around `goToScene`.
- [ ] QA & docs: automated checks, lint/build, update README/PRD with new navigation usage.

### Prep notes
- Routes today: `/` (court/home), `/locker-room`, `/projects` (trading-card binder), `/contact` (front office), `/banners` (dynamic gallery).
- Target scene map: `court` <-> `/`; `locker-room` <-> `/locker-room`; `front-office` <-> `/contact`; `projects` <-> `/projects`; `banners` <-> `/banners`; `film-room` and `rafters` placeholders.
- Shared assets that must persist: tutorial overlays + tour state (`components/court`), ambience/light layers (currently implicit), global SVG container `SvgLayoutContainer`.

### Progress notes
- Added `SceneRouteSync` + `SceneHost` in root layout so Arena shell persists across route changes.
- Scenes implemented: Court (with intro), Locker Room, Front Office, Projects binder, Banners; Film Room/Rafters stubbed.
- Page files now stubbed (`/`, `/locker-room`, `/projects`, `/contact`, `/banners`, `/film-room`, `/rafters`) to rely on SceneHost rendering.
- Navigation triggers now call `goToScene` for back-to-court and court zone entries (projects/about -> front office).
- Camera presets zeroed for all scenes for now (single-scene rendering); will set real world coordinates after stitching shared world.
- Back-to-court button now also pushes `/` to keep URL in sync even if scene context misfires.
- Added stub routes `/about` and `/front-office` that map to the Front Office scene for deep-link compatibility.
- Film Room / Rafters scenes now have explicit placeholder components wired into the renderer.
- Court UI entry buttons now call `goToScene` + `router.push` (rafters/banners, locker room, projects, front office).
