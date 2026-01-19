# PRD — Player-Driven Court Play Breakdown (Landing Page)

## 1) Overview
The Player-Driven Court Play Breakdown transforms the landing page from static content into an interactive “systems storytelling” experience. Visitors control a player avatar on an SVG basketball court. Moving the player into invisible intent zones triggers visual play breakdowns (ball + Xs/Os + markers) that explain engineering principles, tradeoffs, and decision patterns.

The experience prioritizes **how decisions are made under constraints**, not just which technologies are used.

## 2) Goals
### Primary
- Demonstrate systems thinking via spatial interaction (movement = intent).
- Replace (or demote) static “starting lineup” lists with experiential exploration.
- Communicate tradeoffs clearly with minimal text (motion first, tooltip second).

### Secondary
- Keep visuals clean and performant (60fps).
- Support progressive enhancement (click-to-trigger fallback).
- Make play definitions data-driven and extensible.

## 3) Non-goals
- Not a game / simulation (no physics engine, no AI defenders, no scoring).
- No menu-driven UI as the primary interaction.
- No long-form text blocks or modal-heavy explanations on the court.

## 4) Target Users
- Recruiters / hiring managers scanning quickly.
- Senior engineers evaluating systems thinking.
- Friends/peers exploring the “court as navigation” concept.

## 5) UX Summary
1. User sees court + player avatar.
2. User moves avatar (keyboard and/or click-to-move).
3. Entering a **Principle zone** selects a principle.
4. Entering a **Shot zone** triggers a play (principle + shot → play).
5. Court reacts (ball motion + actors appear + brief tooltip).
6. User can interrupt by selecting a different zone at any time.

**Movement is selection. Arrival is intent.**

## 6) Core Concepts
- **Player**: user-controlled cursor / decision maker
- **Ball**: request / data / event flow
- **O**: owned system / internal component
- **X**: constraint, failure mode, or external dependency
- **Cone/Marker**: invariant / boundary / guardrail
- **Zone**: invisible intent region (principle/shot/context)
- **Play**: resolved choreography + actors for (principle, shot, [context])

## 7) Zone Types
- Principle zones (e.g., Scalability, Testing, Architecture Consistency, Clean Code)
- Shot zones (Drive, Kick Out, Reset)
- Optional context zones (Incident Response, Late Game, Prototype Mode) — phase 2+

## 8) State Model (Conceptual)
- `activePrinciple: string | null`
- `activeShot: string | null`
- `activeContext: string | null`

Derived:
- `activePlay = resolvePlay(activePrinciple, activeShot, activeContext)`

## 9) Visual Actors (Constraints)
Always:
- Player, court base, ball

Conditional:
- Xs/Os (only during a play)
- Constraint marker(s) (only when needed)
- Brief arrows/trails (momentary, to explain routing)

Explicitly excluded:
- Crowd/ref/mascot, persistent HUDs, multi-ball chaos

## 10) Success Criteria
Qualitative:
- Visitors explore multiple plays and understand intent quickly.
- Court feels “alive” but still professional.

Quantitative (optional later):
- Zone entries / play triggers per session
- Average time on landing page
- “Play completion” rate (play runs to tooltip)
