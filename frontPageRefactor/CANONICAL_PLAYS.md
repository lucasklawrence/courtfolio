# Canonical Plays (v1)

These are the first 3 plays the system must support. Everything else extends from these patterns.

---

## Play 01 — Drive (Bottleneck Breaker)
**Tagline:** Go directly at the constraint.  
**Engineering meaning:** Identify the bottleneck, reduce it first, then abstract.

### Choreography
- Ball moves from player toward a single choke point (paint/top key).
- A cone appears to represent the constraint (rate limit / CPU / IO / DB lock).
- Ball slows briefly (backpressure), then pulses (decision/fix), then continues.

### Actors
- O: 1–2 (API + DB)
- X: optional (external dependency)
- Cone: required (1)

### Tooltip (2 lines)
- Drive: attack the bottleneck.
- Profile → narrow → fix → then scale out.

---

## Play 02 — Kick Out (Decouple & Fan-Out)
**Tagline:** When coupling is risky, distribute the work.  
**Engineering meaning:** Use async events/queues to fan-out to independent consumers.

### Choreography
- Ball drives toward paint, then kicks out to perimeter.
- Split into 2–3 pulses (or one ball with branching trails).
- One receiving node has slight delay (eventual consistency).

### Actors
- O: 3 (publisher + 2 consumers)
- X: 0–1 (optional external system)
- Cone: optional (contract boundary)

### Tooltip (2 lines)
- Kick Out: decouple with events.
- Fan-out work; accept eventual consistency.

---

## Play 03 — Reset (Stabilize & Simplify)
**Tagline:** Stop forcing it. Re-establish invariants.  
**Engineering meaning:** Stabilize through tests/contracts/refactor; shrink the surface area.

### Choreography
- Ball approaches crowded area and stops.
- Court dims slightly; a ripple expands from the ball (reset moment).
- X markers appear briefly (unknowns/bugs) then fade.
- Ball returns to a stable base (top of key).
- A single clean arrow path appears.

### Actors
- O: 1–2
- X: 2–4 (briefly)
- Cone: not used

### Tooltip (2 lines)
- Reset: stabilize before scaling.
- Add tests + shrink surface area.
