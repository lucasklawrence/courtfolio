export interface TourStep {
  /**
   * X position of the tutorial sprite on the court.
   */
  x: number

  /**
   * Y position of the tutorial sprite on the court.
   */
  y: number

  /**
   * Path to the sprite image for this step.
   */
  img: string

  /**
   * Text message displayed for this step.
   */
  text: string

  /**
   * Optional alternate text to use on mobile.
   */
  mobileText?: string

  /**
   * Optional target DOM element id — used to measure glow position.
   * If provided, this overrides the static glow box.
   */
  targetId?: string

  /**
   * Static glowing highlight (desktop fallback).
   */
  glow?: {
    x: number
    y: number
    width: number
    height: number
    shape?: string
  }

  /**
   * Whether the tutorial sprite should face left (default is right).
   */
  facingLeft?: boolean

  paddingFactor?: number
}

/**
 * Full array of guided tour steps for the court intro.
 */
export const tourSteps: TourStep[] = [
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasIdle4.png',
    text: 'Welcome! I’m Lucas — I’ll walk you through this court. Tap the orange buttons below to continue.',
    mobileText: 'Welcome! I’m Lucas — I’ll walk you through this court. Tap anywhere to continue.',

    glow: { x: 1019, y: 865, width: 133, height: 43 },
    facingLeft: false,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasSpinningBall7.png',
    text: 'This court is my creative space. Some areas are live — others are warming up.',
    glow: {
      x: 650,
      y: 380,
      width: 220,
      height: 250,
      shape: 'circle',
    },
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasIdle5.png',
    text: 'This is my bio — quick overview of who I am.',
    glow: { x: 350, y: 110, width: 380, height: 140 },
    facingLeft: false,
    targetId: 'bio-card',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasSpinningBall7.png',
    text: 'Stats don’t lie. Here’s the résumé highlight reel.',
    glow: { x: 800, y: 110, width: 280, height: 135 },
    facingLeft: false,
    targetId: 'career-stats-card',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasIdle4.png',
    text: 'Head to the locker room for more personal flavor.',
    glow: { x: 1270, y: 60, width: 240, height: 40 },
    facingLeft: false,
    targetId: 'enter-locker-room',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasSpinningBall7.png',
    text: 'Check the rafters — career moments and banners.',
    glow: { x: 1020, y: 60, width: 220, height: 40 },
    facingLeft: false,
    targetId: 'view-rafters',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasIdle5.png',
    text: 'Tech stack lineup. These are my go-to tools.',
    glow: { x: 1175, y: 425, width: 230, height: 135 },
    targetId: 'tech-stack-lineup',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasSpinningBall7.png',
    text: 'Explore the plays — featured projects live here.',
    glow: { x: 800, y: 700, width: 250, height: 100 },
    facingLeft: false,
    targetId: 'projects',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasIdle4.png',
    text: 'Want to connect? Head to the front office.',
    glow: { x: 610, y: 940, width: 320, height: 55 },
    facingLeft: false,
    targetId: 'scouting-area',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasSpinningBall7.png',
    text: 'My core principles — this lineup shows how I play.',
    glow: { x: 110, y: 425, width: 230, height: 140 },
    facingLeft: false,
    targetId: 'principles-lineup',
    paddingFactor: 0.99,
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasIdle5.png',
    text: 'That’s the full tour. Go explore the court!',
  },
  {
    x: 200,
    y: 800,
    img: '/sprites/LucasSpinningBall7.png',
    text: 'You can move around — use arrow keys, WASD, or click anywhere on the court.',
    mobileText: 'Tap anywhere to move around the court.',
    glow: undefined,
    facingLeft: false,
  },
]
