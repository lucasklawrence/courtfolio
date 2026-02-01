// TARGET PATH: src/arena/transitions/variants.ts
export type TransitionVariantName = 'fade' | 'tunnel' | 'ascent' | 'fold' | 'flash'

export type TransitionVariant = {
  overlayClassName: string
}

export const transitionVariants: Record<TransitionVariantName, TransitionVariant> = {
  fade: {
    overlayClassName: 'bg-black',
  },
  tunnel: {
    overlayClassName: 'bg-transparent',
  },
  ascent: {
    overlayClassName: 'bg-transparent',
  },
  fold: {
    overlayClassName: 'bg-transparent',
  },
  flash: {
    overlayClassName: 'bg-transparent',
  },
}
