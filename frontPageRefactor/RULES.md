# Rules & Constraints (Implementation Guardrails)

## Interaction
1. **No menus** for the primary interaction. Movement is selection.
2. Zone selection is **arrival-based** (enter zone → choose).
3. Shot selection requires a principle first:
   - If user enters shot zone without principle: show micro-hint and do nothing else.
4. Plays are **interruptible**:
   - entering any principle/shot zone cancels the current play cleanly.

## Visual
1. Max **3 actor types visible** at once (besides player/court):
   - Ball + (Xs/Os) + (Cone) is enough.
2. Hard caps:
   - `O`: max 3
   - `X`: max 4 (briefly visible)
   - `Cone`: max 1–2
3. Text comes **after** motion.
4. Tooltip is **2 lines max** on the court.

## Layering
Fixed layers, no ad-hoc z-index fights:
1. CourtBase
2. CourtEffects
3. Actors (ball, X/O, cones, arrows)
4. Player
5. UI Overlay

## Performance
- Prefer transform animations (translate/scale/opacity).
- Avoid expensive filters per frame.
- Keep ball choreography simple: 1–3 moves + optional split/pulse.
