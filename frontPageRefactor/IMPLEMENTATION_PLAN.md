# Implementation Plan — Player-Driven Court Play Breakdown

This plan assumes the **current movement system may not exist** or may not support our needs. We explicitly include a **review/compare** step against the target architecture before building.

---

## Phase 0 — Discovery & Review (Mandatory)

### 0.1 Audit current implementation (if any)
Review:
- How player position is stored (state vs ref vs animation state)
- How movement is triggered (keyboard, click-to-move, drag)
- Whether collision/zone detection exists
- SVG layering model (court vs overlays vs player vs UI)
- Animation approach (Framer Motion variants vs manual requestAnimationFrame)
- Browser considerations (Safari/iOS, prefers-reduced-motion)

**Deliverable:** a short notes file summarizing:
- ✅ Reusable pieces
- ⚠️ Needs refactor
- ❌ Missing entirely

### 0.2 Compare current implementation to target architecture
Create a table:

| Capability | Current | Required | Gap |
|---|---:|---:|---|
| Player position state | ? | Yes | ? |
| Movement controls (kb/click) | ? | Yes | ? |
| Zone intersection detection | ? | Yes | ? |
| Layered SVG overlays | ? | Yes | ? |
| Play orchestration | ? | Yes | ? |

**Outcome:** choose one path
- **Path A:** adapt existing movement system
- **Path B:** build minimal movement layer cleanly

---

## Phase 1 — Zone Infrastructure

### 1.1 Create a Zone Registry (data-driven)
Define `CourtZone` and store zones in a single registry file:
- `principles` zones
- `shots` zones
- optional `contexts`

### 1.2 Implement intersection detection (arrival-based)
On every player position update:
- Check intersection with zones.
- Fire `onEnter(zone)` **once per entry**, not continuously.
- Track `currentZoneId` to prevent spam triggers.

Important:
- Selection happens on arrival, not hover.
- Shot zones require principle selected first.

---

## Phase 2 — Play System (data-driven)

### 2.1 Define Play schema
Implement a `Play` schema that contains:
- metadata (title/tagline/tooltip)
- actors (Xs/Os/cones/arrows)
- ball choreography (steps: move/pause/split/pulse)
- optional global effects (dim, ripple)

### 2.2 Implement `resolvePlay()`
`resolvePlay(principleId, shotId, contextId?) => Play | null`

This should be pure and deterministic.

### 2.3 Implement Play Runner
A small orchestrator that:
- accepts a `Play`
- renders actors
- runs ball step sequence
- shows tooltip at end
- supports cancel/interrupt

---

## Phase 3 — Rendering Layers (SVG sanity)

### 3.1 Layer order (fixed)
1. `CourtBaseSvg` (lines + wood)
2. `CourtEffectsLayer` (optional dim/ripple)
3. `ActorsLayer` (Xs/Os/cones/arrows/ball)
4. `PlayerLayer` (player always above actors)
5. `UIOverlayLayer` (tooltip/captions)

### 3.2 Performance guardrails
- Prefer transforms (translate/scale/opacity)
- Keep paths simple
- Keep actor counts low (see rules)
- Avoid heavy SVG filters on every frame

---

## Phase 4 — Progressive Enhancement

### 4.1 Click-to-trigger fallback
If movement is unavailable or disabled:
- clicking a zone triggers selection / play
- same resolver + runner; no duplicate logic paths

### 4.2 Reduced motion support
If `prefers-reduced-motion`:
- reduce durations and/or replace ball animation with instant transitions
- preserve tooltips and actor appearance

---

## Phase 5 — Testing & Polish
- Verify in Safari (desktop + iOS)
- Ensure interruptions don’t leave stale actors or ball state
- Ensure tooltips never overlap critical UI
- Ensure everything is keyboard accessible

---

## Definition of Done (v1)
- Player moves (kb or click-to-move)
- Zones exist and trigger arrival events
- 3 canonical plays run end-to-end
- Tooltips appear after play motion
- Interrupting a play cleanly transitions to the next
- Fallback click-to-trigger works
