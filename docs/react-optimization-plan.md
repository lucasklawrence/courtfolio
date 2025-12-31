# React Optimization Plan (checkpoints)

Purpose: track small, reviewable tasks to tighten React/Next best practices in this repo.

## Checkpoint 0: Prep
- [ ] Run `npm run lint` to surface current lint issues (baseline).
- [ ] Capture bundle/interaction baseline for Locker Room and Project Binder (manual notes are fine).

## Checkpoint 1: Locker Room correctness & hygiene
- [ ] Fix tooltip zone id typo `jereseys` -> `jerseys` to re-enable the jersey caption (`components/locker-room/LockerInfo.tsx`).
- [ ] Add a typed `ZoneId` union shared between `page.tsx`, `LockerInfo`, and `LockerRoomSvg` to prevent future zone mismatches.
- [ ] Remove dev `console.log` calls in `LockerZone` and `LockerInfo`.
- [ ] Clean the stray mojibake characters in Locker Room copy/comments (e.g., descriptions/comments containing `ƒ?` or odd glyphs).

## Checkpoint 2: Client/server boundary audit
- [ ] Inventory `use client` components (already listed via `rg`) and tag which can be server or split.
- [ ] First candidates: `components/common/SectionContainer`, `BackToCourtButton`, and static page wrappers—split to server shells that render client children only where interactivity is needed.
- [ ] Convert at least one page (e.g., `app/projects/page.tsx`) to server + client islands if feasible.

## Checkpoint 3: Layout & device detection robustness
- [ ] Improve `useIsMobile` to rely on `matchMedia` (mobile width/orientation) rather than UA sniffing; guard for SSR.
- [ ] Initialize `SvgLayoutContainer` orientation state from `window` on first render to reduce flicker; keep resize/orientation listeners.
- [ ] Add lightweight tests or story-style manual checklist for mobile/landscape rendering.

## Checkpoint 4: Accessibility pass for interactive SVG zones
- [ ] Add keyboard support (`tabIndex`, `role="button"`, key handlers) to `LockerZone` so zones are focusable/clickable via keyboard.
- [ ] Provide accessible names (aria-label) for each zone; derive from `lockerZoneTooltips`.
- [ ] Ensure text contrast and focus styles are visible in overlays.

## Checkpoint 5: Performance & bundling
- [ ] Identify heavy client assets/components to lazy-load (e.g., large SVGs) via `next/dynamic` where appropriate.
- [ ] Confirm images/SVGs are optimized and not re-rendering unnecessarily; memoize only when profiling justifies it.
- [ ] Re-check bundle after conversions; document impact.

## Checkpoint 6: Copy & docs hygiene
- [ ] Normalize special characters in docs/comments (e.g., mojibake bullets in `SvgLayoutContainer` comment block).
- [ ] Add short usage note in `docs/react-review-principles.md` linking to this plan.

## Handoff notes
- Tackle checkpoints in order; open a small PR per checkpoint.
- After each checkpoint, rerun lint and smoke-test Locker Room/Projects/Contact flows.
