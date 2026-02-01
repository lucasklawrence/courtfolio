# Immersive Scene-Based Navigation PRD & Implementation Plan

## Intro (Why This Exists)

This document defines a **scene-based navigation system** for the personal website. The intent is to move away from page-based navigation (hard transitions between routes) and toward an **immersive, continuous experience** where the site feels like a single place the user moves through — similar to navigating rooms in a game or arena.

This is **not** a traditional SPA rewrite and **not** a 3D engine. It is a 2D, SVG-driven experience that uses state, motion, and routing together to preserve continuity.

This document is written to be handed to an automated coding agent (Codex) or a future contributor. It prioritizes clarity, intent, and architecture over implementation detail.

---

## Overview

The website currently uses page-level routing (e.g. `/locker-room`, `/rafters`) where each route mounts a new page. While fast, this causes:

- Loss of animation and UI continuity
- Hard visual cuts between rooms
- Reset of global state (tutorial sprite, ambience, camera position)

The goal is to introduce a **persistent Arena Shell** with **scene-based transitions** that feel like camera movement rather than navigation.

---

## Problem Statement

Page-based navigation breaks immersion by:

- Unmounting the entire UI tree on navigation
- Resetting animation and motion state
- Making transitions feel like teleports instead of movement

This limits storytelling, motion design, and future features like guided tours or persistent ambience.

---

## Goals

### Primary Goals

- Maintain a **persistent Arena Shell** that never unmounts
- Implement **scene-based navigation** using internal state
- Animate transitions between scenes using a 2D “camera” model
- Preserve clean URLs and deep linking (`/locker-room`, `/rafters`, etc.)

### Secondary Goals

- Enable future features such as:
  - Guided tours
  - Camera presets
  - Reduced-motion accessibility
  - Ambient audio persistence
- Keep architecture understandable and maintainable

---

## Non-Goals

- No 3D rendering (Three.js, WebGL)
- No physics or real camera math
- No rewrite of SVG assets
- No removal of routing entirely

---

## Key Concepts & Terminology

- **Arena Shell**: A persistent layout that contains the SVG court, camera wrapper, lighting, and global UI elements
- **Scene**: A logical room or view (Court, Locker Room, Rafters, Film Room, Front Office)
- **Camera**: A 2D transform wrapper that animates the world (translate, scale, opacity)
- **Scene Router**: Internal state machine controlling which scene is active
- **Route Sync**: Keeping the URL in sync with the active scene without remounting the app

---

## User Experience

### Navigation

- Clicking a zone triggers a smooth animated transition
- The view appears to move through space rather than cut
- The URL updates to reflect the destination scene

### Persistence

- Tutorial sprite remains alive across scenes
- Global ambience and lighting persist
- Motion feels continuous and intentional

---

## Success Criteria

- No full page reloads during navigation
- Arena Shell never unmounts
- Scene transitions animate smoothly
- Direct navigation to `/locker-room` loads the correct scene
- Browser back/forward works as expected

---

## Architecture Overview

```
ArenaShell (persistent)
 ├── CameraWrapper (motion container)
 │    └── SceneRenderer (renders active scene)
 ├── TutorialSprite
 ├── GlobalLighting / Effects
 └── SceneProvider (context)
```

Routing controls **scene state**, not page rendering.

---

## Scene State Management

Introduce a `SceneProvider` that owns:

- `currentScene`
- `previousScene`
- `transitionState`

Example scene IDs:

```
"court" | "locker-room" | "rafters" | "film-room" | "front-office"
```

All navigation happens through a single API:

```
goToScene(sceneId)
```

---

## Camera System (2D)

The camera is implemented as an animated transform wrapper.

Each scene maps to a **camera preset**:

```
{
  x: number,
  y: number,
  scale: number,
  opacity?: number
}
```

Transitions interpolate between presets using Framer Motion.

This keeps motion consistent and avoids per-scene animation logic.

---

## Route Synchronization

- Keep Next.js routes for each scene
- Routes do **not** render separate pages
- Routes update scene state instead

Behavior:

- Direct URL entry sets the initial scene
- Scene changes push URL updates
- Browser back/forward navigates between scenes

---

## Scene Rendering Strategy

Scenes are components, not pages:

```
SceneMap = {
  court,
  locker-room,
  rafters,
  film-room,
  front-office
}
```

Only the active scene renders inside the camera wrapper.

---

## Motion Tokens

Define shared motion tokens for:

- Transition duration
- Easing curves
- Opacity / blur thresholds

This ensures consistency and enables future accessibility controls.

---

## Incremental Migration Strategy

1. Create Arena Shell and SceneProvider
2. Move Court into a scene
3. Migrate one room (Locker Room) as proof of concept
4. Update navigation to use `goToScene`
5. Repeat for remaining rooms

Avoid a big-bang rewrite.

---

## Testing & Validation

- Verify Arena Shell never unmounts
- Confirm scene transitions animate correctly
- Test direct navigation to scene URLs
- Validate browser history behavior

---

## Notes for Codex

- Scenes are **state**, not pages
- The camera is a **transform**, not an object
- Routing should never force remounts
- Optimize for clarity first, polish later

