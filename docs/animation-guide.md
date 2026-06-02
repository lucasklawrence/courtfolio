# Web Animation Guide — Court Vision

A technical reference for the animation techniques used on this site (Next.js 15 App Router · React 19 · Framer Motion v12 · roughjs · SVG), plus modern approaches worth adopting. Organized by the four areas you asked about, with accessibility and 60fps performance woven through.

> **Provenance.** Compiled from a fan-out research pass over authoritative 2025–2026 sources (official Motion docs, MDN, web.dev, Chrome/Next.js docs). The automated verification step in the harness malfunctioned (verifier agents abstained on every claim), so each claim below was instead hand-vetted against the cited primary source and known API behavior. Sources are linked inline. Where a claim needed nuance, it's flagged with ⚠️.

---

## Part 1 — Framer Motion / `motion` patterns

### 1.1 The hybrid engine (why Motion is fast)

Motion runs animations through a **hybrid engine**: where possible it hands off to the browser's native [Web Animations API (WAAPI)](https://motion.dev/docs/react) and `ScrollTimeline`, which can run on the compositor thread (up to 120fps, off the main thread). For things native APIs can't do — **spring physics, interruptible keyframes, gesture tracking, independent transforms** — it falls back to a JS-driven rAF loop. ([motion.dev/docs/react](https://motion.dev/docs/react), [motion.dev/docs/performance](https://motion.dev/docs/performance))

Practical implication: animating `opacity` and simple `transform`s is cheap and compositor-friendly; animating layout properties (`width`, `top`, `margin`) forces the JS path **and** layout recalculation — avoid it (see Part 5).

### 1.2 Default transitions: spring vs tween

Motion picks the transition type per property automatically:
- **Physical properties** (`x`, `y`, `scale`, `rotate`) default to **spring** physics.
- **Visual properties** (`opacity`, `color`, `backgroundColor`) default to **tween** (duration + easing).

([motion.dev/docs/react](https://motion.dev/docs/react)) This is why your `useFadeInProps` (opacity-only) reads as a clean timed fade, while `useSpringUpProps` (which animates `y`) feels bouncy — you're working *with* the defaults.

**Tuning springs** — the three knobs:
- `stiffness` (default ~100) — higher = snappier, faster pull to target. Your `FreeRoamPlayer` uses `170`; `useSpringUpProps` uses `120`.
- `damping` (default ~10) — higher = less oscillation/overshoot. Below ~10 it visibly bounces; your player uses `22` (near-critically damped, no wobble — right for tracking input).
- `mass` (default 1) — higher = more sluggish/heavy.

Rule of thumb: **snappy UI** → high stiffness + high damping (your player). **Playful entrance** → moderate stiffness + low damping (your `SpringUp`). You can also specify a spring by feel with `duration` + `bounce` instead of the physics params.

### 1.3 Your entrance-primitive pattern (and how to extend it)

Your `components/motion/primitives.tsx` is a textbook-good pattern: hooks (`useFadeInProps`, `useFadeUpProps`, `useSpringUpProps`) that return `{ initial, animate, transition }` props to spread onto any `motion.X`, keeping semantic tags (no wrapper `<div>`), plus `motion.div` convenience wrappers for when a wrapper is fine. This is the recommended approach — it composes, it's reduced-motion-aware in one place, and it avoids div soup.

**Natural extensions:**

*Stagger children* — instead of hand-tuning `delay` per item (as `TunnelHero` does with `0.4 / 0.9 / 1.5`), use variant orchestration so the parent drives timing:

```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((t) => <motion.li key={t} variants={item}>{t}</motion.li>)}
</motion.ul>
```

Children inherit the parent's animation state by name — add/remove list items without re-tuning delays. ([motion.dev/docs/react](https://motion.dev/docs/react))

*Scroll-triggered entrance* — swap `animate` for `whileInView` so primitives fire when scrolled into view:

```tsx
<motion.section {...useFadeUpProps()} animate={undefined}
  whileInView="visible" viewport={{ once: true, margin: '-15% 0px' }} />
```

### 1.4 AnimatePresence — exit animations

React unmounts components instantly; to animate something *leaving* (a closing modal, a removed banner, route content), wrap it in `AnimatePresence` and give the child an `exit` prop:

```tsx
<AnimatePresence mode="wait">
  {open && (
    <motion.div key="panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }} />
  )}
</AnimatePresence>
```

- `mode="wait"` — finish the outgoing exit before the incoming enters (good for swaps).
- `mode="popLayout"` — pop exiting elements out of layout flow so siblings reflow smoothly (good for lists).
- Children **must** have a stable, unique `key`.

> **Status on this site:** `app/page.tsx` already wraps the intro→court hand-off in `AnimatePresence mode="wait"` with reduced-motion-aware enter/exit. Issue #207 added directional polish (slide-up exit + rise/scale enter) on top of that base. The same pattern is still the right tool for modals/overlays that currently hard-cut.

### 1.5 Layout animations & shared-element transitions

- `layout` prop — animates an element smoothly when its size/position changes between renders (e.g. a card expanding). Uses the FLIP technique; runs on transforms so it's compositor-friendly.
- `layoutId` — give two **different** elements the same `layoutId` and Motion animates one into the other across mount/unmount (shared-element transition). Perfect for "thumbnail → detail" effects in your `ProjectGallery`/`TradeCard` flow: a project card that morphs into the opened project view.

```tsx
{selected === id
  ? <motion.div layoutId={`card-${id}`} className="detail" />
  : <motion.div layoutId={`card-${id}`} className="thumb" onClick={...} />}
```

### 1.6 Scroll-linked motion: `useScroll` / `useTransform` / `useInView`

- `useScroll()` returns four motion values: `scrollX`/`scrollY` (absolute px) and `scrollXProgress`/`scrollYProgress` (normalized 0–1 over the configured `offset`). Pass `{ target, offset }` to track an element's progress through the viewport. ([motion.dev/docs/react-use-scroll](https://motion.dev/docs/react-use-scroll))
- `useTransform(scrollYProgress, [0, 1], [0, 360])` maps progress to any output range (rotation, opacity, color, `clipPath`, `filter`). Because these are **motion values**, they update the DOM directly **without triggering React re-renders** — that's what keeps scroll effects at 60fps. ([motion.dev/docs/react-use-scroll](https://motion.dev/docs/react-use-scroll))
- Smooth jumpy scroll input by piping it through a spring — the canonical pattern:

```tsx
const { scrollYProgress } = useScroll()
const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })
// <motion.div style={{ scaleX }} /> → a buttery progress bar
```

- `useInView(ref, { once, margin })` returns a boolean for "is this on screen" — lighter than `whileInView` when you only need a trigger, not a bound animation.

### 1.7 Motion values & the rAF bridge (ties directly to `FreeRoamPlayer`)

This is the most important section for your sprite work. Motion values (`useMotionValue`) are the escape hatch from React's render cycle:

- Writing to a motion value (`x.set(...)`) updates the DOM **directly, with no re-render** — exactly what you want from a 60fps rAF loop. ([motion.dev/docs/react-motion-value](https://motion.dev/docs/react-motion-value))
- Read/write imperatively with `.get()` / `.set()`; `.jump(v)` sets instantly with no animation; observe changes with `.on('change', …)` or `useMotionValueEvent`.
- `useSpring(sourceMotionValue, config)` creates a **new** motion value that physically tracks the source — so you write raw target positions and the spring smooths them before they hit the DOM. ([motion.dev/docs/react-use-spring](https://motion.dev/docs/react-use-spring))

Your `FreeRoamPlayer` already does exactly this (`x`/`y` raw → `springX`/`springY` via `useSpring` → `style={{ x: springX }}`). That's the gold-standard bridge: **rAF writes raw values, a spring smooths them, zero re-renders for movement.** The only re-renders are for sprite-frame/state changes, which are intentionally coarse (`setFrameIndex`, `setIsMoving`). Keep it.

### 1.8 Package naming & v12 (⚠️ nuance)

The library was rebranded **`framer-motion` → `motion`**, with React imports moving from `framer-motion` to `motion/react`. ([motion.dev/docs/react-upgrade-guide](https://motion.dev/docs/react-upgrade-guide))

⚠️ **But you don't need to migrate.** `framer-motion` is still published and maintained as an alias of the same v12 codebase — your `import { motion } from 'framer-motion'` keeps working indefinitely. The v12 upgrade itself introduced **no React-facing breaking changes**; it's essentially the rebrand plus dropping legacy-browser support. Migrating is a find-and-replace of the import path, not an API rewrite. Do it only if you want the canonical import; there's no functional payoff.

### 1.9 React 19 / RSC gotchas

- Every `motion.X` component requires the **client** (`'use client'`). Your animated files already have it — keep animations in client components and pass server-fetched data down as props (your `ShuttleTrace` taking `entries` is the right shape).
- **Bundle size:** the full `motion` import is ~30–50kb. For a marketing/portfolio site, use `LazyMotion` + the lightweight `m` component to code-split features and ship as little as ~5kb initial:

```tsx
import { LazyMotion, domAnimation, m } from 'motion/react'
<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />   {/* use m.*, not motion.* */}
</LazyMotion>
```

---

## Part 2 — requestAnimationFrame game loops in React

Your `FreeRoamPlayer` is already a strong implementation. This section confirms the principles and flags the few things worth hardening.

### 2.1 The core loop

`requestAnimationFrame` is the recommended foundation for per-frame loops; the callback always receives a `DOMHighResTimeStamp`. ([MDN — Anatomy of a video game](https://developer.mozilla.org/en-US/docs/Games/Anatomy)) To hold 60Hz, **all** per-frame work (your callback + GC + the browser's compositing) must fit in ~16.5ms. ([MDN](https://developer.mozilla.org/en-US/docs/Games/Anatomy))

### 2.2 Delta-time (you do this correctly)

Multiply movement by elapsed seconds so speed is frame-rate-independent: `dx = SPEED * dt`. ([MDN](https://developer.mozilla.org/en-US/docs/Games/Anatomy)) And **cap `dt`** to avoid teleporting after a tab-away — your `Math.min((now - prevTime) / 1000, 0.1)` is exactly the recommended guard.

### 2.3 Fixed timestep vs render rate (advanced, optional)

For physics that must be deterministic regardless of display rate, the canonical technique is to **decouple the simulation from rendering**: step the sim at a fixed frequency (e.g. 20–60Hz) using an accumulator, and render/interpolate as often as the display allows. ([MDN](https://developer.mozilla.org/en-US/docs/Games/Anatomy), [Isaac Sukin's game-loop writeup](https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing)) Your variable-timestep loop is perfectly fine for a single sprite — only reach for a fixed accumulator if you add collision/physics that misbehave at high refresh rates.

### 2.4 React-specific patterns (you nail these)

- **Refs for hot state.** Input (`keysRef`), timing (`prevTime`), and the rAF handle live in refs so the loop reads/writes them without re-rendering. ([CSS-Tricks — rAF with React hooks](https://css-tricks.com/using-requestanimationframe-with-react-hooks/))
- **Mirror state into refs** when an interval/loop must read current React state without re-subscribing — your `isMovingRef`/`isShootingPoseRef` mirrors are the right move and a commonly-missed trick.
- **Cleanup:** `cancelAnimationFrame(handle)` in the effect's return, and a `cancelled` flag to ignore a frame that fires after teardown. You do both.
- **Coarse re-renders only:** sprite-frame swaps and facing changes go through `setState` (cheap, infrequent); position goes through motion values (no render). Correct separation.

### 2.5 Worth adding: pause when off-screen / hidden tab

rAF already pauses in background tabs, but you keep ticking when the player scrolls out of view. Two cheap wins:
- Listen for `document.visibilitychange` and skip the heavy work (or reset `prevTime` on resume so the first post-resume `dt` isn't huge — your cap handles the worst case, but resetting is cleaner).
- Use an `IntersectionObserver` on the court SVG to stop the loop entirely when the court isn't visible. Saves battery on long pages.

### 2.6 Sprite-frame animation

Cycling frames on a time threshold (`now - walkFrameTimeRef.current > WALK_FRAME_MS`) is the standard approach and decouples animation speed from frame rate — good. For many sprites, prefer a **single sprite-sheet** + CSS `background-position` steps (or `object-position`) over swapping `<img src>` to avoid per-frame network/decoding hitches. For two frames it doesn't matter; if you expand the animation, sheet it.

---

## Part 3 — Animated SVG

### 3.1 Two ways to "draw" a line/path

**(a) `stroke-dasharray` + `stroke-dashoffset`** — the classic self-drawing-line trick. Set the dash array to the path's total length, then animate `stroke-dashoffset` from `length → 0` and the line appears to draw itself. ([CSS-Tricks — How SVG Line Animation Works](https://css-tricks.com/svg-line-animation-works/)) Pure CSS, compositor-friendly, great for outline reveals (e.g. drawing a court boundary on load):

```css
.trace { stroke-dasharray: var(--len); stroke-dashoffset: var(--len);
         animation: draw 1.2s ease forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
```

Get `var(--len)` from `path.getTotalLength()`. In Motion, the equivalent is animating `pathLength` from 0→1 directly on `motion.path` — no manual length math.

**(b) rAF lerp along a polyline** — your `ShuttleTrace` approach: compute position at progress `t` by interpolating between geometry anchors, rebuild the `points` string each frame. This is the right tool when the motion is **data-driven and physically meaningful** (real-time pacing per run, a dot that must be *at* a cone at a specific time). Dasharray can't express "race these two runs at their real speeds"; your lerp can. Keep using lerp where the *timing* carries meaning, and dasharray/`pathLength` where you just want a decorative reveal.

### 3.2 Animating along an arbitrary path

For "move an element along this exact curve" without hand-deriving geometry: CSS [`offset-path`](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path) + `offset-distance` (animate 0%→100%) follows any path declaratively and runs on the compositor. Good for a ball arcing along a shot trajectory. For SVG-native, `<animateMotion>` exists but is less controllable than CSS offset-path or JS.

### 3.3 SVG filters: glow & drop-shadow

`feGaussianBlur` blurs its input by `stdDeviation` (the Gaussian bell width). ([MDN — feGaussianBlur](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur)) Your `#shuttle-glow` filter (`feGaussianBlur stdDeviation="2.4"` under a duplicated wider stroke) is the standard glow recipe. The fuller drop-shadow/glow recipe composes primitives: blur `SourceAlpha` → `feOffset` → `feMerge` the blurred copy behind the original. ([MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur))

⚠️ **Performance caveat:** SVG filters (especially blur) are **expensive to animate** — they typically re-rasterize each frame and are *not* compositor-accelerated. Your usage is fine because the glow filter is applied to a mostly-static trail, not animated per frame. **Don't** animate `stdDeviation` or filter params in an rAF loop; if you need a pulsing glow, animate `opacity` on a pre-blurred layer instead. For simple shadows, prefer the CSS `filter: drop-shadow()` / `box-shadow` over SVG filter graphs where you can.

### 3.4 roughjs — the sketchy aesthetic, animated safely

How the look works: rough.js perturbs **every spatial point** by a random offset whose magnitude scales with the `roughness` parameter (each point is replaced by a random point within a circle whose size grows with roughness). It also **renders each stroke twice** and randomizes the endpoints plus two intermediate sample points (~50% and ~75% along the line) to get the bowed, double-drawn look. ([Rough.js algorithms — by its author, Preet Shihn](https://shihn.ca/posts/2020/roughjs-algorithms/))

**The critical animation rule (which your code already follows):** that randomization is re-rolled on every regenerate unless you pin the **`seed`**. Your `RoughOptions.seed` doc comment — *"Deterministic seed so SSR + client renders match exactly"* — is exactly right, and it's also what stops the sketch from **jittering every frame** when a rough shape lives inside an animating component. Rules:
- **Always pass a stable `seed`** to any rough shape that re-renders (animation, resize, data refresh). Without it, every render reshuffles the wobble and the art "boils."
- **Don't regenerate rough geometry per frame.** Generating rough paths is comparatively expensive. For animation, generate the rough `<path>` **once** (memoize on the inputs that actually change shape), then animate cheap properties on it — `opacity`, `transform`, `stroke-dashoffset`, `strokeOpacity`. Your `ShuttleTrace` correctly keeps the *court markings* as static rough shapes and animates a **plain** `<polyline>` for the moving trail — never re-rough the moving part. Keep that boundary.

### 3.5 Data-driven SVG (your charts)

Your chart layer maps data → pixels with `d3-scale`, then draws with rough shapes. To animate value changes (a bar growing, a point moving when data updates), animate the **scaled output** — interpolate the mapped coordinate/height with a motion value or `useTransform`, not the raw datum — so easing happens in screen space. Keep the rough path's `seed` fixed across the transition so only position/size animates, not the sketch texture.

### 3.6 Reduced motion for SVG (you do this right)

Your `ShuttleTrace` snaps every enabled trace to its **finished state** (`progress = 1`) under `useReducedMotion`, preserving the spatial story (which cones, what path shape) while removing the motion. This is the correct accessibility pattern — *don't* just disable the animation and show an empty court; show the **end state**. Apply the same "snap to final" rule to any future SVG reveal.

---

## Part 4 — Modern / advanced motion (not yet in your stack)

### 4.1 CSS scroll-driven animations (`animation-timeline`)

The native spec adds two timeline types via `animation-timeline`: a **Scroll Progress Timeline** (`scroll()`) tied to a scroll container's position, and a **View Progress Timeline** (`view()`) tied to an element's progress through the viewport. ([Chrome — Scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations), [Josh Comeau](https://www.joshwcomeau.com/animation/scroll-driven-animations/))

```css
.reveal { animation: fade-up linear both; animation-timeline: view();
          animation-range: entry 0% cover 40%; }
@keyframes fade-up { from { opacity: 0; transform: translateY(30px); } }
```

- **Why it matters:** these run **off the main thread** (browser scrolling happens in a separate process with async event delivery), so they avoid the jank of JS `scroll` listeners. ([Chrome](https://developer.chrome.com/docs/css-ui/scroll-driven-animations)) Zero JS, zero bundle cost.
- **Browser support (2026):** shipped in Chromium and Firefox; **Safari still lacks it** (in progress). Treat as a **progressive enhancement** — wrap in `@supports (animation-timeline: view())` and let non-supporting browsers show the static end state.
- **When to use:** scroll-reveal entrances, progress bars, parallax — anywhere you'd otherwise reach for `useScroll`. For your portfolio's section reveals this is lighter than Framer Motion and worth adopting behind `@supports`.
- **vs Framer `useScroll`:** Framer works everywhere today and integrates with your motion values; native is lighter and smoother but not universal. Use native for decoration, Framer when you need cross-browser certainty or to drive JS logic.

### 4.2 View Transitions API

Animates between two DOM states (or two pages) by snapshotting before/after and cross-fading/morphing — including shared-element morphs via `view-transition-name`.

- **Same-document:** `document.startViewTransition(() => updateDOM())`. Broad Chromium/Safari support; Firefox catching up.
- **Cross-document (MPA):** opt in with `@view-transition { navigation: auto; }` — animates real page navigations with no JS.
- **React/Next.js:** React 19.2 ships an experimental `<ViewTransition>` component, and Next.js has a `viewTransition` config flag for the App Router. ([Next.js — View Transitions](https://nextjs.org/docs/app/guides/view-transitions), [React 19.2 + Next 16 view transitions](https://www.digitalapplied.com/blog/react-19-2-view-transitions-animate-navigation-nextjs-16)) Still experimental — gate it and provide a no-transition fallback.
- **When to use:** route changes (court → locker room → training facility) and thumbnail→detail morphs. Note this **overlaps** with Framer's `layoutId` shared-element transitions — `layoutId` is the stable choice *within* a page today; View Transitions shine *across* route navigations.

### 4.3 WebGL / shaders (three.js, react-three-fiber)

- **When it's the right tool:** true 3D, particle systems, fluid/displacement, GPU shader effects, thousands of animated elements. A WebGL canvas is one compositor layer, so it can animate huge scenes at 60fps that would melt SVG/DOM.
- **When it's overkill (probably your case):** for 2D scenes, hand-drawn art, charts, and a sprite that moves around a court, **SVG + Framer + rAF is the correct, lighter choice.** react-three-fiber pulls in three.js (~150kb+) and a steep complexity/accessibility cost. Reach for it only if you want a genuinely 3D centerpiece (e.g. a spinning 3D trophy/arena). Otherwise the cost/benefit doesn't favor it for a portfolio.
- If you do: lazy-load the canvas, respect `prefers-reduced-motion` by freezing the scene, and pause the render loop when off-screen.

### 4.4 CSS `@keyframes` — where it still beats JS

For **looping, declarative, independent** animations (a pulsing heart, a bouncing ball, a spinner, ambient background drift), CSS `@keyframes` + `animation` is lighter and runs on the compositor with **zero JS**. Your `PulsingHeart` is the right call. Use CSS keyframes when the animation: (1) loops or is fire-and-forget, (2) doesn't need to react to JS state mid-flight, (3) animates only `transform`/`opacity`. Reach for Framer/rAF only when you need orchestration, interruption, gestures, physics, or data-driven values.

### 4.5 GSAP + ScrollTrigger

- **Status (2026):** GSAP is now **fully free, including all plugins (ScrollTrigger, etc.)** following the Webflow acquisition — the old paid "Club" plugins are open. ([GSAP scroll animation guide](https://gsapvault.com/blog/how-to-animate-on-scroll))
- **Strengths:** the most powerful timeline sequencing, pin/scrub scroll choreography (ScrollTrigger), and rock-solid cross-browser behavior. Best-in-class for complex, art-directed scroll storytelling.
- **vs your stack:** GSAP and Framer overlap heavily. You already have Framer; adding GSAP means a second animation runtime (~bundle cost) and two mental models. **Recommendation:** stick with Framer + native scroll-driven CSS for now; only add GSAP if you build an elaborate, timeline-heavy scroll narrative that Framer's `useScroll` makes awkward. Don't run both for ordinary effects.

### 4.6 Spring physics libraries

Framer's `useSpring` already covers your needs. Alternatives (`react-spring`, `@react-spring/web`) exist and are excellent, but adding one alongside Framer is redundant. Only relevant if you ever drop Framer.

---

## Part 5 — Cross-cutting: accessibility & 60fps

### 5.1 Animate only compositor-friendly properties

The single biggest performance rule: **animate `transform` and `opacity` only.** ([web.dev — Animations guide](https://web.dev/articles/animations-guide), [web.dev — Animations and performance](https://web.dev/articles/animations-and-performance))
- `transform` (translate/scale/rotate) and `opacity` can be handled by the **compositor thread** — no layout, no paint, no main-thread work. 60fps even under JS load.
- Animating `width`, `height`, `top`, `left`, `margin`, `padding` triggers **layout** (reflow) every frame → jank. Use `transform: translate()`/`scale()` instead. (Your `FreeRoamPlayer` correctly drives `x`/`y`/`scale`, not `left`/`top`.)
- Animating `box-shadow`, `background`, `color`, filters triggers **paint** — cheaper than layout but still main-thread. Fine occasionally, not per-frame.

### 5.2 `will-change` — sparingly

`will-change: transform` hints the browser to promote an element to its own layer ahead of time, smoothing the start of an animation. But **over-using it wastes memory** (every promoted layer costs GPU memory) and can *hurt*. Add it just before an animation and remove it after; never blanket-apply it. Motion/CSS often handle promotion automatically — only reach for `will-change` to fix a measured hitch.

### 5.3 Avoid layout thrash

Don't interleave DOM **reads** (`getBoundingClientRect`, `offsetWidth`, `clientWidth`) and **writes** (style changes) in a loop — each read after a write forces a synchronous layout. Batch reads, then writes. Your `FreeRoamPlayer` caches bounds (`boundsCache`) and reads via `ResizeObserver` rather than measuring per frame — that's the correct pattern; keep measurement out of the rAF tick.

### 5.4 `prefers-reduced-motion` — the right way

Honor the OS "reduce motion" setting everywhere. ([MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion))
- **In Framer:** `useReducedMotion()` returns a boolean (and re-renders when the OS setting changes); use it to substitute reduced values *before* spreading onto components — your primitives do this (`initial: reduce ? false : {...}`). ([motion.dev/docs/react-use-reduced-motion](https://motion.dev/docs/react-use-reduced-motion))
- **In rAF/SVG:** snap to the **final state** rather than disabling outright — your `ShuttleTrace` (`progress = 1`) is the model. The user still gets the information, just no motion.
- **In CSS:** guard keyframe/scroll-driven animations:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important;
    animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
```
- **Don't kill *all* motion blindly** — opacity fades and essential state changes are usually fine; it's *large translations, parallax, spin, and zoom* that trigger vestibular issues. Reduce those specifically.

### 5.5 Bundle-size summary

| Technique | Cost | Notes |
|---|---|---|
| CSS `@keyframes` / scroll-driven | **0 kb** | Compositor, no JS. Prefer for loops & reveals. |
| `useMotionValue` + rAF (yours) | ~Framer | No re-renders; cheapest dynamic option. |
| Framer full `motion` | ~30–50 kb | Use `LazyMotion` + `m` to cut to ~5kb initial. |
| roughjs | ~9 kb | Generate once, animate cheap props. |
| GSAP + ScrollTrigger | ~40–70 kb | Redundant alongside Framer — skip unless needed. |
| three.js / r3f | ~150 kb+ | Only for genuine 3D/GPU work. |

---

## TL;DR — what to do with this

**Your foundations are right.** The rAF→`useSpring` bridge in `FreeRoamPlayer`, the seed-pinned roughjs, the snap-to-final reduced-motion handling, the transform/opacity-only animation, and the reusable entrance hooks are all best-practice.

**Highest-value additions, in order:**
1. **`AnimatePresence`** on the intro→court and any modal/overlay. *(The intro→court base already exists; #207 added directional polish. Remaining: modals/overlays that still hard-cut.)*
2. **Native scroll-driven CSS** (`animation-timeline: view()`) behind `@supports` for section reveals — free and smooth. *(Issue #208)*
3. **`layoutId` shared-element** morphs in the project gallery (thumbnail → detail). *(Issue #209)*
4. **`LazyMotion` + `m`** to shrink the Framer bundle on the marketing pages. *(Issue #210)*
5. **Variant `staggerChildren`** to replace hand-tuned per-element delays (e.g. `TunnelHero`). *(Issue #211)*
6. **Off-screen loop pause** (IntersectionObserver) for `FreeRoamPlayer`. *(Issue #212)*

**Skip for now:** GSAP, react-three-fiber, extra spring libraries — all redundant with what you have unless a specific 3D/timeline-heavy feature demands them.

---

### Sources (all primary/authoritative unless noted)
- Motion docs: [react](https://motion.dev/docs/react) · [use-scroll](https://motion.dev/docs/react-use-scroll) · [use-spring](https://motion.dev/docs/react-use-spring) · [motion-value](https://motion.dev/docs/react-motion-value) · [use-reduced-motion](https://motion.dev/docs/react-use-reduced-motion) · [performance](https://motion.dev/docs/performance) · [upgrade-guide](https://motion.dev/docs/react-upgrade-guide)
- MDN: [Anatomy of a video game](https://developer.mozilla.org/en-US/docs/Games/Anatomy) · [feGaussianBlur](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur) · [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- web.dev: [Animations guide](https://web.dev/articles/animations-guide) · [Animations and performance](https://web.dev/articles/animations-and-performance)
- Chrome: [Scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations)
- Next.js: [View Transitions](https://nextjs.org/docs/app/guides/view-transitions)
- CSS-Tricks: [SVG line animation](https://css-tricks.com/svg-line-animation-works/) · [rAF with React hooks](https://css-tricks.com/using-requestanimationframe-with-react-hooks/) *(blog)*
- [Rough.js algorithms — Preet Shihn](https://shihn.ca/posts/2020/roughjs-algorithms/) · [Josh Comeau — scroll-driven](https://www.joshwcomeau.com/animation/scroll-driven-animations/) · [Isaac Sukin — game loops](https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing) *(blogs)*
