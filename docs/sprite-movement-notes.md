# Sprite Movement Review (FreeRoamPlayer)

## Overview
- Coordinate system: screen-space from `getScaledCourtBounds` (viewBox 1536x1024, playable box x=85,y=90,w=1300,h=780), clamped via `clampToCourt` using half sprite width/height.
- Initial position: x=730, y=1340 (outside court), gets snapped by `useCourtResizeClamp` on mount.
- Movement: keyboard adds fixed 8px per keydown; click-to-move steps 2.5px per animation frame to target with 1.5px stop threshold. Speeds are frame-dependent.
- Scaling: sprite scale = svg.clientWidth / 1536 clamped to [0.5, 1]. Clamp uses unscaled `PLAYER_SIZE`, so edges slightly over-reserved when scale < 1.
- Resize: `useCourtResizeClamp` re-clamps on resize/orientation; click path doesn’t re-clamp mid-move but resize hook will snap after resize.

## Recommendations
1) Initialize inside the court: set initial x/y within playable box (e.g., center ~x=735, y=480) or clamp once before render to avoid first-frame snap.
2) Use time-based movement for keyboard and click-to-move (delta from `performance.now()`), making speed consistent across frame rates.
3) Optional: clamp using `PLAYER_SIZE * scale` for tighter edge accuracy.
4) Optional: re-evaluate bounds during click animation if frequent resizes are expected (resize clamp already snaps on resize).

## Files referenced
- components/court/FreeRoamPlayer.tsx
- utils/movements.ts
- utils/hooks/useCourtResizeClamp.ts
