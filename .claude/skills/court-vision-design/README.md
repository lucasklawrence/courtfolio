# Court Vision — Design System

**Court Vision** is the design language of [lucasklawrence.com](https://lucasklawrence.com), Lucas Lawrence's personal portfolio. The site is built as an interactive basketball court — visitors don't scroll a résumé, they walk onto the floor, take a tour with a sprite, peek into the locker room, hang banners in the rafters, and stop by the front office to talk shop.

The brand sits at the intersection of **basketball, hip-hop / EDM, video games, and engineering**. Visually, that means: court-night blacks, spotlight oranges, championship-banner yellows, and warm hardwood/leather. Tonally, it means basketball language used everywhere — playbooks, scouting reports, lineups, jerseys, banners — applied to engineering work.

> *"Writing code with court vision."* — Lucas's tagline, as it appears in the TunnelHero intro.

---

## Sources

- **Codebase:** `lucasklawrence/courtfolio` (GitHub) — Next.js + TypeScript + Tailwind + Framer Motion. Read on demand via `github_get_tree` / `github_read_file`.
- **Live site:** https://lucasklawrence.com
- **Sister site:** Bars of the Day (a hip-hop bars project — flavor for the music side of the brand)

Nothing from the repo is pre-loaded into this project beyond a curated set of icons and the court SVG. Pull more on demand.

---

## Index

| File / Folder        | What's inside                                                |
|----------------------|--------------------------------------------------------------|
| `README.md`          | This file — context, tone, visuals, iconography             |
| `colors_and_type.css`| All design tokens (colors, type, spacing, radii, shadows)   |
| `SKILL.md`           | Agent-Skills entry point                                    |
| `assets/`            | Logos, court SVG, icon library                              |
| `assets/icons/`      | Hand-built SVG icons (basketball, trophy, ps5, vinyl, etc.) |
| `preview/`           | Design-system review cards (registered as assets)           |
| `ui_kits/courtfolio/`| Pixel-faithful recreation of the live site, JSX components  |

---

## Content Fundamentals

The voice is **first-person, casual, and confident, with basketball metaphor stitched into engineering language**. It never breaks character.

**Person & address.** Mostly first-person ("I'll walk you through this court"). When directing the visitor, second-person imperative is used ("Tap anywhere to continue.", "Head to the front office.").

**Casing.** Title Case for zone labels and banner titles ("Enter Locker Room", "View The Rafters", "Granted Patent on Network Sync"). Sentence case for body copy and tour bubbles. UPPERCASE only on small mono eyebrows ("LUCAS LAWRENCE // TECH STACK BINDER", "🕵️ SCOUTING AREA").

**Punctuation.** Em dashes and hyphens are common ("Welcome! I'm Lucas — I'll walk you through this court."). Sentences are short and punchy. The right-curl apostrophe (`'`) is used in source.

**Basketball metaphor — applied everywhere.** This is the whole brand. Examples lifted verbatim:
- Engineering principles → "Starting 5 Principles": Clean Code = Point Guard #7 (MVP). Scalability = Small Forward #11 (Clutch Performer). Test Coverage = Power Forward #13 (Sixth Man).
- Tech stack → "Tech Stack Lineup": #10 React (PG), #22 Spring Boot (SG), #33 Kafka (SF), #18 PostgreSQL (PF), #44 Kubernetes (C).
- Skills self-rating → "Shot Range": "🟢 React & Next.js — deep range", "🟡 Kafka & gRPC — confident midrange", "🔵 SVG & D3 — crafty finishes".
- Career history → "Scouting Report": "Position: Full-Stack Playmaker", "Strengths: React handles, Java core, court vision in architecture", "Court IQ: High — reads legacy systems, system player".
- Achievements wall → "The Rafters" with "Where legacies hang forever." as subtitle.
- Promo → "Promoted to Senior Software Engineer" sits next to "DCSA Fall League — High Division Champs" with no hierarchy difference.
- Job-search line → "Free Agent Notes: Open to dream teams with creativity + scale."
- Contact CTA → "📫 Go to Front Office" / "📄 Resume" inside a "🕵️ Scouting Area".
- Closer → *"Plays drawn in code. Championships built in commits."*

**Vibe.** Warm, playful, never corporate. The site greets you ("Welcome! I'm Lucas") and walks you around personally. It's confident without bragging — accomplishments live as banners "hanging" in the rafters rather than a bullet list.

**Emoji.** Used liberally and on-brand: 🏀 (the most-used — appears on Back to Court, Step Onto the Court, banners), 🏟️ (Rafters), 🧳 (Locker Room), 🎨 (Project Binder), 📫 (Contact), 📄 (Resume), 🕵️ (Scouting), 📈📜🚀🗂️🥇🌟🏆🧢⭐👑🎓🕯️🎤 (banner badges), ⛹️ / ⛹️‍♂️ (About / exit). They sit alongside text rather than replace it.

---

## Visual Foundations

### Two Coexisting Moods

The brand toggles between two surfaces that share the same accents:

1. **Arena (default).** Black/charcoal stage. Vertical gradient from `#000` through `#171717` back to `#000`. A diffused orange radial blur sits at center as a "spotlight". Court SVG ghosts at 10% opacity behind hero text. White type, orange-300 mono accents.
2. **Hardwood / Locker.** Warm browns (`#42210b` rich, `#5a3015` hover), used for zone-entry buttons, locker placards, and the binder page. Yellow-300 type sits on these surfaces. Stays cozy, never glossy.

Both moods coexist on the same page — the court is black, the buttons hovering over it are wood-and-yellow, the banners hanging from the ceiling are yellow cloth.

### Color in use
- **Primary action (button):** `--orange-primary` (#ea580c) → hover `--orange-spotlight` (#f97316). Used on tour Skip/Next, Replay Tour, anything that says "do this."
- **Locker / zone entry:** `--hardwood-rich` bg, `--banner-gold` border, `--banner-yellow` text. The wood-on-gold-on-yellow combo *is* the navigation language.
- **Banner cloth:** `--banner-yellow` fill with black text and a small dark hanging-bar at top — hung as `<motion.div>` with subtle 5s sway.
- **Tagline / typewriter:** `--orange-soft` (#fdba74) on black, mono.
- **Paper surfaces (resume, sign-here line, scouting clipboard):** cream paper with serif/handwriting type and a hand-drawn underline.
- **No purples, no teals.** Every color earns its place by mapping to a real basketball arena element.

### Backgrounds & textures
- Court SVG (`assets/court.svg`) — used full-bleed at 10% opacity behind hero, and as the actual interactive playable surface.
- Leather binder texture — `bg-[url('/textures/binder-leather.png')]` for the Project Binder page (texture file not imported; substitute with a wood-grain placeholder if needed).
- Vertical 3-stop gradient (`from-black via-neutral-900 to-black`) for full-page night surfaces.
- Radial orange blur ("spotlight") — `bg-orange-500 blur-3xl opacity-30 rounded-full` centered.
- No glassmorphism on arena pages. Locker zones do use a `backdrop-filter: blur(4px)` on `rgba(38,20,4,0.7)` for the modern ZoneAbout/About-Me chip.

### Typography
- **Geist Sans** for everything UI (headings, body, buttons). 400/500/600/700/800 in active use.
- **Geist Mono** for taglines, eyebrow text, page numbers ("Page 1"), `Lucas Lawrence // Tech Stack Binder`, and the typewriter intro line.
- **Patrick Hand** (handwriting) for the front-office "x ___" sign-here line and any hand-marked annotation. Loaded as Tailwind's `font-handwriting`.
- **Georgia / serif** only on the "View Full Resume (PDF)" link to signal "official document".
- Headings are `font-extrabold` and sometimes uppercase ("The Rafters" is bold-but-not-uppercase). Letter-spacing is tight on display, wide on mono eyebrows.

### Animation
- **Framer Motion** is the sole animation library. Springs, not eases, are the default.
- **TunnelHero** entry: `opacity 0→1, y 40→0`, duration 0.5–0.8s, staggered `delay 0.4 → 0.9 → 1.5`. Then a typewriter ("Writing code with court vision.") at typeSpeed 100ms.
- **Banner sway:** `rotate: [0, 1.2–1.8°, -1.2–1.8°, 0]`, 5s loop, easeInOut, randomized `swayDelay`. Each banner sways out of phase. This is the brand's signature ambient motion.
- **Tutorial sprite:** position is a `useSpring(stiffness 120, damping 14)` on x/y. Sprite slides between tour steps; speech bubble appears beside it; faces left/right based on movement direction.
- **Page transitions:** simple cross-fade `opacity 0↔1` with `AnimatePresence mode="wait"`, duration 1s.
- **Hover states:** `transition` (Tailwind's default 150–200ms), color/bg swap. No scale-up on most elements; lineup cards do `whileHover={{ scale: 1.03 }}`.
- **No shake, no bounce, no parallax.**

### Hover & press
- Primary button: `bg-orange-600 → hover:bg-orange-700` (or `→ hover:bg-orange-500` on the replay tour pill — yes, both directions appear).
- Locker zones: opacity ramp `opacity-90 → hover:opacity-100`.
- Black pills: `bg-black → hover:bg-orange-500` (full color flip — bold).
- Press / focus: `focus:outline-none focus:ring-2 focus:ring-orange-400`.
- Cursor: `cursor-pointer` is set on most action buttons.
- No active-state scale-down. No haptic-style press feedback.

### Borders, radii, shadows
- **Radii** strongly favor pills (`rounded-full`) for actions, `rounded-xl` (12px) for speech bubbles and zone-entry buttons, `rounded-2xl` (16px) for lineup cards, `rounded-md` for tags.
- **Borders** are usually `border border-yellow-400` on locker buttons or `border border-neutral-300` on paper cards. A subtle orange-tinted border (`rgba(255,165,0,0.30)`) is used on translucent locker zones.
- **Shadows** are flat and warm: `shadow-md` on most cards, `shadow-lg` on speech bubbles, `shadow-xl` on banners. There is no real elevation system — most depth is communicated by background color, not by stacking shadows.
- **Glow:** the tutorial overlay uses an SVG `feGaussianBlur` over the spotlight target, plus a darkened-mask backdrop (`rgba(0,0,0,0.55)`).

### Layout
- `SectionContainer` clamps content to `max-width: 1600px` with `mx-auto` and `px-2 sm:px-4`.
- Court page is an SVG-stage layout — children are positioned by `<foreignObject x y width height>` rather than flow layout. Mobile uses `useCourtResizeClamp` to keep things on-screen.
- Banner page and binder page use ordinary flex/grid.
- Mobile-first: orientation-aware overlays (`MobileAdvanceOverlay`), touch-action: pan-x pan-y on body, sprite scale clamped to 0.5–1.0 of viewBox ratio.

### Transparency & blur
- Used sparingly. Locker `ZoneAboutModern`/`ZoneContactModern` use `rgba(38,20,4,0.7) + backdrop-blur(4px)` for chips that float over the court.
- The Scouting Area chip uses `bg-white/90` over the court SVG.
- Imagery is never blurred for "vibe."

### Imagery treatment
- Hand-illustrated SVGs of real basketball gear (jerseys, sneakers, basketballs, a PS5 controller, headphones, vinyl, a trophy, a duffel bag, a cat named Zoe). All are warm-toned, slightly cartoony, no realism, no gradients-for-shading.
- A pixel-art-ish PNG sprite of "Lucas" in idle / dribbling poses is the tour guide.
- No stock photography. No b&w. No grain filter.

### Cards
- **Banner card:** yellow cloth rectangle with rounded top, dark hanging bar above, a small triangle pennant cut at the bottom edge. Year (bold), icon (large emoji), title (centered, semibold). Sways.
- **Lineup card:** white rounded-2xl, neutral-300 border, jersey-number bookmark in orange (top-right), name → italic position → bullet list of strengths → black award pill at bottom.
- **Bio / career-stats / projects:** orange-tinted translucent rectangles with `border-orange-300/40` over the court SVG.

---

## Iconography

Court Vision has a distinct, **hand-rolled SVG icon vocabulary** — no Lucide, no Material, no FontAwesome. Every icon is a custom illustration of a real basketball-room object.

- **Source location:** `assets/icons/` — basketball, headphones, trophy, vinyl, ps5-controller, scouting-report. Plus the brand logos (`assets/court-vision-logo.svg`, `assets/ghost-logo.svg`, `assets/favicon.svg`).
- **Style:** flat-fill SVG with multi-color palettes (no monochrome icon font). Sized 80–340px in the source — these are illustrations as much as icons. Stroke-based icon sets would clash.
- **Background SVG:** `assets/court.svg` is the playable court layout — used both as the interactive stage and (at 10% opacity) as a hero background.
- **Emoji as iconography.** Where a small icon is needed inline (zone-entry buttons, banner badges, scouting list), emoji are used directly: 🏀 🏟️ 🧳 🎨 📫 🕵️ 📄 ⛹️. Treat emoji as legitimate brand glyphs here; do *not* swap them out for a stroked icon set.
- **Logo:** "Court Vision" wordmark + small basketball glyph (`assets/court-vision-logo.svg`). The Snap "Ghost Logo" appears on the Snap Inc. locker jersey only — it's a real-employer reference, not a brand mark.
- **No icon font.** No Tailwind heroicons. No `react-icons`.
- **If you need an icon not in the set:** prefer drawing a small flat-fill SVG illustration in the same vocabulary, or use an emoji. Avoid stroke-line icon sets (Lucide/Heroicons-outline) — they will look foreign.

### Substitutions flagged
- **Geist & Geist Mono** — original site uses `next/font/google`. Loaded here from Google Fonts CDN — visually identical, no flag needed.
- **Patrick Hand** — loaded from Google Fonts as in the source.
- **Binder leather texture** (`/textures/binder-leather.png`) — not imported; if needed, substitute with a CSS wood-grain or solid `--hardwood-rich`.
- **Lucas sprite PNGs** (`LucasIdle4/5`, `LucasDribbling2/3`) — not imported (1.5MB each). Reference by description; ask user before re-importing.

---

## Caveats & open questions

- The court is *huge* (1536×1024 viewBox) and the original is engineered for SVG-stage navigation. The UI kit recreates a faithful arena hero + key zones, not the full pan-around player movement.
- No production design system / Figma was provided — tokens are reverse-engineered from Tailwind classes in source.
