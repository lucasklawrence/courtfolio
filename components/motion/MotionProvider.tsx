'use client'

import { LazyMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Dynamically imports the `domMax` feature bundle (see `./features`) so Framer
 * Motion's feature code loads as a separate chunk instead of in the initial JS
 * payload. The promise resolves the first time a motion component mounts.
 */
const loadMotionFeatures = () => import('./features').then(mod => mod.default)

/** Props for {@link MotionProvider}. */
type MotionProviderProps = {
  /** Application subtree that may render `m.*` motion components. */
  children: ReactNode
}

/**
 * App-wide Framer Motion provider. Mounts a single {@link LazyMotion} high in
 * the client tree so every `m.*` component shares one lazily-loaded feature
 * bundle rather than each `motion.*` import pulling the full library into its
 * route's chunk.
 *
 * `strict` makes Framer throw if a full `motion.*` component is rendered within
 * this subtree, which would silently defeat the code-splitting — render `m.*`
 * everywhere instead.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      {children}
    </LazyMotion>
  )
}
