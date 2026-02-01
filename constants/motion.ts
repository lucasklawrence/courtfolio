export const motionTokens = {
  transition: {
    duration: 0.9,
    ease: [0.16, 1, 0.3, 1] as const,
  },
  fade: {
    duration: 0.6,
    ease: [0.33, 1, 0.68, 1] as const,
  },
  opacity: {
    entering: 1,
    exiting: 0.85,
  },
  blur: {
    entering: 0,
    exiting: 6,
  },
  reduced: {
    duration: 0.001,
    ease: 'linear' as const,
  },
}
