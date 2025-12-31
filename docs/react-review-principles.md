# React/Next Principles Guide

Purpose: be the checklist and context for reviewing this repo's React/Next code.

## How to use
- Before coding: skim sections relevant to the change (components, data fetching, styling, etc.).
- During review: walk the checklist; add comments for any misses.
- After review: propose small fixes or follow-up tasks.
- For ongoing refactors, pair this with `docs/react-optimization-plan.md` to follow current checkpoints.

## Principles

### Architecture & files
- Prefer server components; mark `use client` only when needed (state, effects, browser APIs, event handlers, refs).
- Co-locate files with features; keep file names clear (`ComponentName.tsx`, `hooks/useThing.ts`).
- Keep components focused; extract reusable bits and avoid mega-files.

### Data flow & state
- Push state down; derive instead of duplicating.
- Keep global state minimal; prefer props + local state; context only when many consumers.
- Stable keys for lists; avoid index keys unless static.

### Effects & hooks
- Avoid `useEffect` for data derivation-compute in render when possible.
- Side-effects belong in `useEffect`; memoize handlers/values (`useCallback`/`useMemo`) only when there's a measurable benefit (stability for deps or perf).

### Data fetching (Next 15)
- Server-fetch by default; pass data as props to client components.
- Use fetch caching configs (`{ cache: 'no-store' }` or revalidate) explicitly when needed.
- Provide loading and empty states; surface errors thoughtfully.

### Components & rendering
- Keep props simple and typed; prefer explicit prop objects over `any`.
- Avoid prop drilling by extracting children slots or small contexts when justified.
- Keep JSX readable; extract sections into small components.

### Styling & layout (Tailwind)
- Use Tailwind utility classes; group logically (layout > spacing > color > effects).
- Encapsulate repeated class combos with small components or helpers when reused.
- Respect responsive and accessibility needs (focus states, contrasts).

### Accessibility & UX
- Use semantic elements first; wire labels to inputs; provide alt text.
- Ensure keyboard reachability and visible focus.
- ARIA only when semantics aren't enough.

### Performance
- Avoid unnecessary rerenders: stable keys, minimal state, avoid re-creating large objects in render.
- Use dynamic imports for heavy/rarely used client code.
- Images: prefer optimized assets and correct sizing.

### Error handling & observability
- Use Next `error.tsx`/`loading.tsx` where appropriate.
- Guard async boundaries; show friendly fallback and log actionable info (no secrets).

### Type safety & linting
- Strict, explicit types for props/returns; avoid `any`.
- Run `npm run lint` before merging; keep formatting consistent with Prettier.

## Quick review checklist
- Correct component type (server vs client)? `use client` only when necessary?
- State minimal and in the right place? No duplicated/derived state?
- Effects only for side-effects? No render-time data in `useEffect`?
- Data fetching server-first with clear caching/revalidation? Loading/empty/error states present?
- Props and types clear? No `any`? Stable list keys?
- JSX readable and modular? No mega-components?
- Tailwind classes sensible and consistent? Responsive/focus states covered?
- Accessibility: semantic elements, labels/alt, keyboard/focus?
- Performance: avoid rerender churn; memo only when it helps; heavy bits code-split?
- Tests/lint: does it pass `npm run lint`? Any obvious test gaps for critical logic?
