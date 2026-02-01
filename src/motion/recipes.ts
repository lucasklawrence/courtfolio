// TARGET PATH: src/motion/recipes.ts
import { motion } from './tokens'

export type TransitionKind =
  | 'to-court'
  | 'to-locker'
  | 'to-rafters'
  | 'to-binder'
  | 'to-office'

export type TransitionPhase = {
  duration: number
  ease: number[]
}

export type TransitionRecipe = {
  out: TransitionPhase
  in: TransitionPhase
}

export const defaultTransition: TransitionRecipe = {
  out: { duration: motion.duration.base, ease: motion.ease.inOut },
  in: { duration: motion.duration.base, ease: motion.ease.out },
}

export const transitionRecipes: Partial<Record<TransitionKind, TransitionRecipe>> = {
  'to-locker': {
    out: { duration: motion.duration.slow, ease: motion.ease.inOut },
    in: { duration: motion.duration.base, ease: motion.ease.out },
  },
  'to-rafters': {
    out: { duration: motion.duration.cinematic, ease: motion.ease.inOut },
    in: { duration: motion.duration.slow, ease: motion.ease.out },
  },
  'to-binder': {
    out: { duration: motion.duration.slow, ease: motion.ease.inOut },
    in: { duration: motion.duration.fast, ease: motion.ease.out },
  },
  'to-office': {
    out: { duration: motion.duration.fast, ease: motion.ease.out },
    in: { duration: motion.duration.fast, ease: motion.ease.out },
  },
  'to-court': {
    out: { duration: motion.duration.base, ease: motion.ease.inOut },
    in: { duration: motion.duration.fast, ease: motion.ease.out },
  },
}
