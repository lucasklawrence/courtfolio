'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'

type BaseProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate'>

type FadeInProps = BaseProps & {
  delay?: number
  duration?: number
}

type FadeUpProps = FadeInProps & {
  y?: number
}

type SpringUpProps = BaseProps & {
  delay?: number
  y?: number
}

export function FadeIn({
  delay = 0,
  duration = 0.5,
  transition,
  ...rest
}: FadeInProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration, ...transition }}
      {...rest}
    />
  )
}

export function FadeUp({
  delay = 0,
  duration = 0.5,
  y = 20,
  transition,
  ...rest
}: FadeUpProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration, ...transition }}
      {...rest}
    />
  )
}

export function SpringUp({
  delay = 0,
  y = 20,
  transition,
  ...rest
}: SpringUpProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 12, delay, ...transition }}
      {...rest}
    />
  )
}
