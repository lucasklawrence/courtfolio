# Court Vision — Design System

The full design system (tokens, typography, color palette, iconography, voice, components) lives as a Claude Skill at:

[`.claude/skills/court-vision-design/`](../.claude/skills/court-vision-design/README.md)

When working on visual or copy-related changes, read that bundle first — it's the single source of truth for the brand.

## Quick reference

- **Voice:** first-person, casual, basketball metaphor stitched into engineering language ("Starting 5 Principles", "Tech Stack Lineup", "The Rafters")
- **Core palette:** black + charcoal arena, hardwood brown (`#42210b` / `#5a3015`), spotlight orange (`#ea580c` primary, `#f97316` hover, `#fdba74` soft), banner yellow (`#fde047` / `#facc15`)
- **Type:** Geist Sans (display + body), Geist Mono (eyebrows / taglines), Patrick Hand (hand-marked annotations)
- **Iconography:** hand-illustrated multi-color SVGs + on-brand emoji (🏀 🏟️ 🧳 🎨 📫 🕵️). No Lucide / Heroicons / FontAwesome.
- **Animation:** Framer Motion springs. Banners sway. No bounce, no parallax.

For more detail — content fundamentals, hover/press states, layout, transparency, imagery, cards, every token — see the skill README.

## Invoking the skill

If you're using Claude Code in this repo, run `/court-vision-design` to load the design context interactively.
