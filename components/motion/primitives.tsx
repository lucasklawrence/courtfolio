'use client'

import { motion, useReducedMotion, type HTMLMotionProps, type MotionProps } from 'framer-motion'

type EntranceProps = Pick<MotionProps, 'initial' | 'animate' | 'transition'>

/**
 * Returns Framer Motion props for a simple opacity fade-in entrance.
 *
 * Spread onto any `motion.X` element so the surrounding markup keeps its
 * semantic tag (no wrapper div). Skips the entrance keyframe entirely when
 * the user has `prefers-reduced-motion: reduce` set.
 *
 * @param delay - Seconds before the animation starts. Default `0`.
 * @param duration - Animation length in seconds. Default `0.5`.
 */
export function useFadeInProps({
  delay = 0,
  duration = 0.5,
}: { delay?: number; duration?: number } = {}): EntranceProps {
  const reduce = useReducedMotion()
  return {
    initial: reduce ? false : { opacity: 0 },
    animate: { opacity: 1 },
    transition: { delay, duration },
  }
}

/**
 * Returns Framer Motion props for a fade-and-rise entrance — opacity 0→1 while
 * translating from `y` pixels below to its resting position.
 *
 * Spread onto any `motion.X` element. Skips the entrance keyframe entirely when
 * the user has `prefers-reduced-motion: reduce` set.
 *
 * @param delay - Seconds before the animation starts. Default `0`.
 * @param duration - Animation length in seconds. Default `0.5`.
 * @param y - Starting vertical offset in pixels (positive = below resting position). Default `20`.
 */
export function useFadeUpProps({
  delay = 0,
  duration = 0.5,
  y = 20,
}: { delay?: number; duration?: number; y?: number } = {}): EntranceProps {
  const reduce = useReducedMotion()
  return {
    initial: reduce ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration },
  }
}

/**
 * Returns Framer Motion props for a spring-physics fade-and-rise entrance.
 *
 * Same shape as `useFadeUpProps` but uses a spring transition (`stiffness: 120`,
 * `damping: 12`) for a slightly bouncier feel. Spread onto any `motion.X`
 * element. Skips the entrance keyframe entirely when the user has
 * `prefers-reduced-motion: reduce` set.
 *
 * @param delay - Seconds before the animation starts. Default `0`.
 * @param y - Starting vertical offset in pixels (positive = below resting position). Default `20`.
 */
export function useSpringUpProps({
  delay = 0,
  y = 20,
}: { delay?: number; y?: number } = {}): EntranceProps {
  const reduce = useReducedMotion()
  return {
    initial: reduce ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring', stiffness: 120, damping: 12, delay },
  }
}

type BaseDivProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate'>
type FadeInDivProps = BaseDivProps & { delay?: number; duration?: number }
type FadeUpDivProps = FadeInDivProps & { y?: number }
type SpringUpDivProps = BaseDivProps & { delay?: number; y?: number }

/**
 * `motion.div` wrapper that applies the `useFadeInProps` entrance.
 *
 * Use when a wrapping div is acceptable. For semantic elements (`h1`, `p`,
 * `button`, etc.), prefer the `useFadeInProps` hook spread onto the
 * `motion.X` directly so no extra div is injected.
 *
 * @param delay - Forwarded to `useFadeInProps`. Default `0`.
 * @param duration - Forwarded to `useFadeInProps`. Default `0.5`.
 * @param transition - Caller-supplied transition fields, shallow-merged on top of the primitive's transition.
 */
export function FadeIn({ delay, duration, transition, ...rest }: FadeInDivProps) {
  const props = useFadeInProps({ delay, duration })
  return (
    <motion.div
      {...props}
      transition={{ ...props.transition, ...transition }}
      {...rest}
    />
  )
}

/**
 * `motion.div` wrapper that applies the `useFadeUpProps` entrance.
 *
 * Use when a wrapping div is acceptable. For semantic elements, prefer the
 * `useFadeUpProps` hook spread onto the `motion.X` directly.
 *
 * @param delay - Forwarded to `useFadeUpProps`. Default `0`.
 * @param duration - Forwarded to `useFadeUpProps`. Default `0.5`.
 * @param y - Forwarded to `useFadeUpProps`. Default `20`.
 * @param transition - Caller-supplied transition fields, shallow-merged on top of the primitive's transition.
 */
export function FadeUp({ delay, duration, y, transition, ...rest }: FadeUpDivProps) {
  const props = useFadeUpProps({ delay, duration, y })
  return (
    <motion.div
      {...props}
      transition={{ ...props.transition, ...transition }}
      {...rest}
    />
  )
}

/**
 * `motion.div` wrapper that applies the `useSpringUpProps` entrance.
 *
 * Use when a wrapping div is acceptable. For semantic elements, prefer the
 * `useSpringUpProps` hook spread onto the `motion.X` directly.
 *
 * @param delay - Forwarded to `useSpringUpProps`. Default `0`.
 * @param y - Forwarded to `useSpringUpProps`. Default `20`.
 * @param transition - Caller-supplied transition fields, shallow-merged on top of the primitive's spring transition.
 */
export function SpringUp({ delay, y, transition, ...rest }: SpringUpDivProps) {
  const props = useSpringUpProps({ delay, y })
  return (
    <motion.div
      {...props}
      transition={{ ...props.transition, ...transition }}
      {...rest}
    />
  )
}

/** Props for the orchestrating parent returned by {@link useStaggerContainerProps}. */
type StaggerContainerProps = Pick<MotionProps, 'initial' | 'animate' | 'variants'>

/** Props for a single staggered child returned by {@link staggerItemProps}. */
type StaggerItemProps = Pick<MotionProps, 'variants'>

/**
 * Returns Framer Motion props for a parent that orchestrates a staggered
 * entrance of its children. Spread onto the wrapping `motion.X`, then give each
 * child the props from {@link staggerItemProps}; the children animate in
 * sequence by inheriting the parent's `hidden`/`show` variant state, so no
 * per-child `delay` is needed — adding or removing a child reflows the cascade
 * automatically.
 *
 * Under `prefers-reduced-motion: reduce` the entrance is skipped entirely
 * (`initial={false}` short-circuits the whole subtree to its resting state),
 * matching the instant behavior of the other entrance primitives here.
 *
 * @param stagger - Seconds between consecutive children entering. Default `0.18`.
 * @param delayChildren - Seconds before the first child begins. Default `0.3`.
 */
export function useStaggerContainerProps({
  stagger = 0.18,
  delayChildren = 0.3,
}: { stagger?: number; delayChildren?: number } = {}): StaggerContainerProps {
  const reduce = useReducedMotion()
  return {
    initial: reduce ? false : 'hidden',
    animate: 'show',
    variants: {
      hidden: {},
      show: { transition: { staggerChildren: stagger, delayChildren } },
    },
  }
}

/**
 * Returns the `variants` prop for a child of a {@link useStaggerContainerProps}
 * parent: a fade-and-rise (`opacity` 0→1 while translating up from `y`px below).
 * The parent's `staggerChildren` decides *when* each child runs, so timing
 * lives on the container, not here. Spread the same returned object onto every
 * child — the variant labels, not object identity, drive the animation.
 *
 * Intentionally **not** a hook (no `use` prefix, calls no hooks): it can be
 * called inside a `.map()` over a list of children without violating the rules
 * of hooks. Reduced motion is handled by the parent's `initial={false}`, so the
 * `y` offset is never applied when reduced motion is requested.
 *
 * @param y - Starting vertical offset in pixels (positive = below resting position). Default `20`.
 * @param duration - Per-child entrance length in seconds. Default `0.5`.
 */
export function staggerItemProps({
  y = 20,
  duration = 0.5,
}: { y?: number; duration?: number } = {}): StaggerItemProps {
  return {
    variants: {
      hidden: { opacity: 0, y },
      show: { opacity: 1, y: 0, transition: { duration } },
    },
  }
}
