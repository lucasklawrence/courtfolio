'use client'

import { motion, useReducedMotion, type HTMLMotionProps, type MotionProps } from 'framer-motion'

type EntranceProps = Pick<MotionProps, 'initial' | 'animate' | 'transition'>

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
