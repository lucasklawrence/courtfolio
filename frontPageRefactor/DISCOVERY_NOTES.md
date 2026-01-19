# Discovery Notes - Court Play System

## Audit Summary (Phase 0.1)

Reusable pieces
- `components/court/CourtSvg.tsx`: base court rendering + viewBox sizing.
- `components/court/FreeRoamPlayer.tsx`: keyboard + click-to-move movement.
- `components/court/CourtInteractionLayer.tsx`: click/tap handling and ripple feedback.
- `components/common/SvgLayoutContainer.tsx`: responsive court layout wrapper.
- `utils/movements.ts` + `utils/hooks/useCourtResizeClamp.ts`: clamp and resize safety.

Needs refactor
- Movement state is internal to `FreeRoamPlayer` (no external position feed for zone detection).
- Movement speed is frame-based; no time-based delta.
- No zone registry; no intersection or arrival-based triggers.
- Layering is implicit (SVG + overlays) rather than explicit per play layers.

Missing entirely
- Data-driven zone registry (principle/shot/context).
- Zone intersection detection with arrival-based enter events.
- Play schema registry + `resolvePlay()`.
- Play runner (ball choreography, actors, effects, tooltip sequencing).
- Reduced-motion handling for play animation.
- Click-to-trigger fallback path.

## Architecture Comparison (Phase 0.2)

| Capability | Current | Required | Gap |
|---|---:|---:|---|
| Player position state | Internal only | Yes (shared) | Expose position to zone system |
| Movement controls (kb/click) | Yes | Yes | Reuse |
| Zone intersection detection | No | Yes | Build |
| Layered SVG overlays | Partial | Yes | Add play layers |
| Play orchestration | No | Yes | Build |

## Path Choice
- Path A: adapt existing movement system (recommended).
