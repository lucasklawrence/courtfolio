import type { Transition } from 'framer-motion'

/**
 * Builds the shared `layoutId` that links a gallery {@link TradeCard} to its
 * expanded `ProjectDetail` panel. Giving both elements the same `layoutId` is
 * what lets Framer Motion morph one into the other across mount/unmount — the
 * "card flies open into the detail, then back" shared-element transition.
 *
 * @param slug - The project's unique slug.
 * @returns A stable id of the form `card-<slug>`.
 */
export function cardLayoutId(slug: string): string {
  return `card-${slug}`
}

/**
 * Spring applied as the `layout` transition on both the {@link TradeCard} and
 * the detail panel, so the open and close morphs are symmetric. Tuned to feel
 * deliberate rather than floaty: high stiffness with near-critical damping pulls
 * the element to its target quickly and settles with no visible wobble.
 */
export const CARD_MORPH_SPRING: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
}
