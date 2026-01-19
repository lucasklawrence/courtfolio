# Court Play System — Docs Bundle

This bundle contains:
- `PRD.md` — product requirements
- `IMPLEMENTATION_PLAN.md` — phased plan (includes review/compare step)
- `RULES.md` — guardrails for interaction, visuals, layering, performance
- `CANONICAL_PLAYS.md` — the first 3 canonical plays
- `plays.schema.ts` — TypeScript schema for data-driven play definitions
- `plays.sample.ts` — sample canonical play objects (replace zone IDs/anchors)

## How to use with Codex
1. Put these files into your repo under something like:
   - `/docs/court-play-system/` (markdown)
   - `/src/features/court-plays/` (schema + sample plays)
2. Ask Codex to implement:
   - Zone registry + intersection detection
   - Play resolver + play runner
   - Ball + actors rendering layers
   - Progressive enhancement fallback

## Notes
- The sample play objects use placeholder `zoneId`s like `anchor.topKey`.
  Replace them with your actual court zone/anchor system.
