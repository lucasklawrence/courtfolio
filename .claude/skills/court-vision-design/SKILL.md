---
name: court-vision-design
description: Use this skill to generate well-branded interfaces and assets for Lucas Lawrence's Court Vision brand (the basketball-themed personal portfolio at lucasklawrence.com), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

- **Brand voice**: first-person, casual, basketball-metaphor-forward. Engineering principles are presented as a starting five with jersey numbers; tech stacks are lineups; achievements are banners hanging in "the rafters"; contact is a "front office"; skills are a "shot range".
- **Core palette**: black + charcoal arena, hardwood brown (#42210b / #5a3015) wood elements, spotlight orange (#ea580c primary, #f97316 hover, #fdba74 soft), banner yellow (#fde047 / #facc15).
- **Type**: Geist Sans (display + body), Geist Mono (eyebrows / taglines / page numbers), Patrick Hand (handwritten flavor — sign-here lines).
- **Iconography**: hand-illustrated multi-color SVGs for objects; on-brand emoji (🏀 🏟️ 🧳 🎨 📫 🕵️) for inline glyphs. Do NOT use Lucide / Heroicons / FontAwesome — they will look foreign.
- **Animation**: Framer Motion springs. Banners sway. Sprite-with-speech-bubble walks the user through tour steps. No bouncy, no parallax.
- **Surfaces**: Black gradient arena (with orange radial spotlight blur) is the default; warm hardwood/leather is the secondary surface for binder + locker pages.

## Files in this skill

- `README.md` — full design context, content fundamentals, visual foundations, iconography
- `colors_and_type.css` — design tokens (CSS variables) + ready-to-use semantic classes
- `assets/` — court SVG, brand logos, hand-drawn icon library
- `preview/` — small specimen cards demonstrating each design-system concept
