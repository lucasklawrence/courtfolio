# Arena Route Transitions — PRD + Implementation (Flat, Codex-Ready)

This document contains **everything Codex needs** to implement the Arena-based
route transition system.

- PRD (what + why)
- Implementation plan (how)
- Resulting folder structure
- Flat, copy‑pasteable file templates
- Each file includes a **TARGET PATH** comment

No ZIPs. No nesting. Deterministic output.

---

# PART 1 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Overview

The personal website is modeled as a **basketball arena**.
Navigation between pages should feel like moving through real spaces
(Court → Locker Room → Rafters, etc.), not like traditional page loads.

Although each room has its own URL, the **ArenaShell remains mounted** so
transitions can be cinematic, spatial, and intentional.

---

## 2. Goals

- Preserve standard Next.js routing and deep links
- Keep the court/arena as a persistent world
- Centralize all motion logic
- Allow user control over animation intensity
- Respect accessibility (`prefers-reduced-motion`)
- Avoid per-page animation hacks

---

## 3. Non‑Goals

- Full SVG morphing between arbitrary scenes
- Mandatory settings screens
- Browser‑exclusive APIs as the only solution

---

## 4. Core Navigation Flows

| From | To | Transition |
|----|----|----|
| Court | Locker Room | Tunnel walk |
| Court | Rafters | Vertical ascension |
| Court | Project Binder | Playbook fold |
| Court | Front Office | Media lights |
| Any Room | Court | Lights down → whistle |

---

## 5. Behavioral Rules

- First visit to a room → cinematic transition
- Repeat visit → shortened transition
- Motion preference `off` → no overlay, instant navigation
- Back/forward browser navigation must still work
- ArenaShell must **never unmount** during arena navigation

---

## 6. User Preferences (Coach Clipboard)

### Supported Preferences (V1)
- Motion: `cinematic | quick | off | system`
- Tutorial: on/off
- Sound: optional future toggle

### Principles
- Preferences affect **experience**, not structure
- Stored in `localStorage`
- No authentication required
- On‑theme UI (clipboard), not a generic settings page

---

## 7. Success Criteria

- Navigation feels spatial, not page‑based
- Court feels like a real anchor, not a background
- Users can reduce/disable motion without breaking UX
- Adding a new room requires **no refactor**

---

# PART 2 — RESULTING FOLDER STRUCTURE

After Codex places the files, the repo should look like:

```text
app/
  (arena)/
    layout.tsx

src/
  arena/
    ArenaShell.tsx
    CourtZoneLink.tsx
    transitions/
      TransitionOverlay.tsx
      variants.ts

  motion/
    tokens.ts
    recipes.ts
    scale.ts

  prefs/
    preferences.types.ts
    preferences.store.ts
    PreferencesProvider.tsx

  ui/
    CoachClipboard.tsx
```

---

# PART 3 — IMPLEMENTATION PLAN

## Phase 1 — Arena Shell Foundation
- Create `(arena)` route group
- Add `ArenaShell` as persistent layout
- Provide navigation context
- No fancy visuals yet

## Phase 2 — Motion Tokens
- Centralize durations, easings, springs
- Eliminate magic numbers
- Introduce transition “recipes”

## Phase 3 — Preferences
- Add PreferencesProvider
- Persist to localStorage
- Map preference → motion scale

## Phase 4 — Coach Clipboard
- Minimal UI (drawer / details)
- Motion selector
- Tutorial toggle

## Phase 5 — Signature Transitions (Future)
- Tunnel mask (locker room)
- Vertical pan (rafters)
- Fold animation (projects)
- Flash lighting (front office)

---

# PART 4 — FLAT FILE TEMPLATES

## File: app/(arena)/layout.tsx

```tsx
// TARGET PATH: app/(arena)/layout.tsx
import type { ReactNode } from "react";
import { ArenaShell } from "@/src/arena/ArenaShell";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return <ArenaShell>{children}</ArenaShell>;
}
```

---

## File: src/motion/tokens.ts

```ts
// TARGET PATH: src/motion/tokens.ts
export const motion = {
  duration: {
    instant: 0.12,
    fast: 0.22,
    base: 0.32,
    slow: 0.48,
    cinematic: 0.72,
  },
  ease: {
    out: [0.16, 1, 0.3, 1],
    inOut: [0.65, 0, 0.35, 1],
    anticipate: [0.2, 0.9, 0.2, 1],
  },
};
```

---

## File: src/motion/scale.ts

```ts
// TARGET PATH: src/motion/scale.ts
import type { MotionPreference } from "../prefs/preferences.types";

export function getMotionScale(
  pref: MotionPreference,
  prefersReducedMotion: boolean
) {
  if (pref === "off") return 0;
  if (pref === "quick") return 0.6;
  if (pref === "cinematic") return 1;
  return prefersReducedMotion ? 0 : 1;
}
```

---

## File: src/motion/recipes.ts

```ts
// TARGET PATH: src/motion/recipes.ts
import { motion } from "./tokens";

export type TransitionKind =
  | "to-court"
  | "to-locker"
  | "to-rafters"
  | "to-binder"
  | "to-office";

export const transitionRecipes = {
  "to-locker": {
    out: { duration: motion.duration.slow, ease: motion.ease.inOut },
    in: { duration: motion.duration.base, ease: motion.ease.out },
  },
  "to-rafters": {
    out: { duration: motion.duration.cinematic, ease: motion.ease.inOut },
    in: { duration: motion.duration.slow, ease: motion.ease.out },
  },
};
```

---

## File: src/prefs/preferences.types.ts

```ts
// TARGET PATH: src/prefs/preferences.types.ts
export type MotionPreference = "cinematic" | "quick" | "off" | "system";

export type UserPrefs = {
  motion: MotionPreference;
  tutorial: boolean;
};
```

---

## File: src/prefs/PreferencesProvider.tsx

```tsx
// TARGET PATH: src/prefs/PreferencesProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const PrefsContext = createContext<any>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState({ motion: "cinematic", tutorial: true });

  useEffect(() => {
    const raw = localStorage.getItem("arena:prefs");
    if (raw) setPrefs(JSON.parse(raw));
  }, []);

  const updatePrefs = (next: any) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    localStorage.setItem("arena:prefs", JSON.stringify(merged));
  };

  return (
    <PrefsContext.Provider value={{ prefs, updatePrefs }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function useUserPrefs() {
  return useContext(PrefsContext);
}
```

---

## File: src/ui/CoachClipboard.tsx

```tsx
// TARGET PATH: src/ui/CoachClipboard.tsx
"use client";

import { useUserPrefs } from "../prefs/PreferencesProvider";

export function CoachClipboard() {
  const { prefs, updatePrefs } = useUserPrefs();

  return (
    <details className="fixed bottom-4 right-4 z-50 bg-white p-3 rounded">
      <summary>Coach Clipboard</summary>
      <select
        value={prefs.motion}
        onChange={(e) => updatePrefs({ motion: e.target.value })}
      >
        <option value="cinematic">Cinematic</option>
        <option value="quick">Quick</option>
        <option value="off">Off</option>
        <option value="system">System</option>
      </select>
    </details>
  );
}
```

---

## File: src/arena/ArenaShell.tsx

```tsx
// TARGET PATH: src/arena/ArenaShell.tsx
"use client";

import React, { createContext, useContext, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PreferencesProvider, useUserPrefs } from "../prefs/PreferencesProvider";
import { getMotionScale } from "../motion/scale";
import { CoachClipboard } from "../ui/CoachClipboard";

const ArenaNavContext = createContext<any>(null);

export function useArenaNav() {
  return useContext(ArenaNavContext);
}

function ArenaShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { prefs } = useUserPrefs();
  const transitioning = useRef(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scale = getMotionScale(prefs.motion, prefersReducedMotion);

  const navigate = (to: string) => {
    if (transitioning.current || to === pathname) return;
    transitioning.current = true;
    router.push(to);
    requestAnimationFrame(() => (transitioning.current = false));
  };

  return (
    <ArenaNavContext.Provider value={{ navigate }}>
      <div className="relative min-h-screen">
        <div className="absolute inset-0">{/* persistent court SVG */}</div>
        <div className="relative z-10">{children}</div>
        <CoachClipboard />
      </div>
    </ArenaNavContext.Provider>
  );
}

export function ArenaShell({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ArenaShellInner>{children}</ArenaShellInner>
    </PreferencesProvider>
  );
}
```

---

# PART 5 — FINAL NOTES FOR CODEX

- Do not refactor existing pages
- Court SVG must live inside `ArenaShell`
- Fade‑only transitions are acceptable for Phase 1
- Signature transitions come later via `variants.ts`
- Optimize for correctness over flair

END OF DOCUMENT
