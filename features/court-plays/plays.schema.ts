/**
 * Play system schema for data-driven court plays.
 */

export type ZoneRef = string

export type ActorType = 'O' | 'X' | 'CONE' | 'ARROW'

export type Anchor = { x: number; y: number } | { zoneId: ZoneRef }

export type Actor = {
  id: string
  type: ActorType
  at: Anchor
  enterAtMs?: number
  exitAtMs?: number
}

export type BallStep =
  | { kind: 'move'; to: Anchor; durationMs: number; ease?: string }
  | { kind: 'pause'; durationMs: number }
  | { kind: 'split'; branches: Array<{ to: Anchor; durationMs: number; ease?: string }> }
  | { kind: 'pulse'; durationMs: number }

export type Play = {
  id: string
  principleId: string
  shotId: string
  title: string
  tagline: string
  tooltip: { line1: string; line2: string }
  actors: Actor[]
  ball: {
    origin: Anchor
    steps: BallStep[]
  }
  effects?: {
    dimCourt?: boolean
    rippleAtMs?: number
  }
}

export type PlayKey = `${string}::${string}`

export type PlayRegistry = Record<PlayKey, Play>
