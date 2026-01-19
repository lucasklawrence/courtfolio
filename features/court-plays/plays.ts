/**
 * Full v1 Play Registry - all principle x shot combinations.
 * NOTE:
 * - Replace anchors in A.* with your court anchors.
 * - Choreography is shot-driven; messaging is principle-driven.
 */

import type { Play, PlayRegistry } from './plays.schema'

const A = {
  PLAYER_START: 'anchor.playStartLeft',
  TOP_KEY: 'anchor.topKey',
  PAINT: 'anchor.paint',
  ARC_LEFT: 'anchor.arcLeft',
  ARC_RIGHT: 'anchor.arcRight',
  ARC_TOP: 'anchor.arcTop',
} as const

type PrincipleId = 'clarity' | 'architecture' | 'scalability' | 'testing' | 'observability' | 'craft'
type ShotId = 'drive' | 'kickout' | 'reset'

const POS = {
  ELBOW_LEFT: { x: 360, y: 460 },
  ELBOW_RIGHT: { x: 520, y: 460 },
  MID_LANE: { x: 400, y: 500 },
  SHORT_CORNER: { x: 300, y: 560 },
  LANE_TOP: { x: 430, y: 330 },
  LANE_TOP_LEFT: { x: 410, y: 320 },
  LANE_TOP_RIGHT: { x: 450, y: 320 },
  WEAK_WING: { x: 540, y: 520 },
} as const

const tooltips: Record<`${PrincipleId}::${ShotId}`, { line1: string; line2: string }> = {
  'clarity::drive': {
    line1: 'Drive: simplify the bottleneck.',
    line2: 'Rename -> isolate -> delete complexity.',
  },
  'architecture::drive': {
    line1: 'Drive: enforce the boundary.',
    line2: 'Contract first; then optimize safely.',
  },
  'scalability::drive': {
    line1: 'Drive: attack the bottleneck.',
    line2: 'Profile -> narrow -> fix -> then scale out.',
  },
  'testing::drive': {
    line1: 'Drive: pin the failure.',
    line2: 'Repro -> unit test -> fix -> prevent regressions.',
  },
  'observability::drive': {
    line1: 'Drive: illuminate the hotspot.',
    line2: 'Trace it -> measure it -> reduce MTTR.',
  },
  'craft::drive': {
    line1: 'Drive: polish what hurts.',
    line2: 'Fix friction at the point of use.',
  },

  'clarity::kickout': {
    line1: 'Kick Out: separate concerns.',
    line2: 'Small modules; clear responsibilities.',
  },
  'architecture::kickout': {
    line1: 'Kick Out: decouple with events.',
    line2: 'Fan-out work; accept eventual consistency.',
  },
  'scalability::kickout': {
    line1: 'Kick Out: distribute the load.',
    line2: 'Async fan-out; scale consumers independently.',
  },
  'testing::kickout': {
    line1: 'Kick Out: test at the seams.',
    line2: 'Mock boundaries; verify contracts.',
  },
  'observability::kickout': {
    line1: 'Kick Out: correlate the flow.',
    line2: 'Trace across services; keep context.',
  },
  'craft::kickout': {
    line1: 'Kick Out: keep the UX smooth.',
    line2: 'Move work off the critical path.',
  },

  'clarity::reset': {
    line1: 'Reset: reduce surface area.',
    line2: 'Fewer knobs; clearer defaults.',
  },
  'architecture::reset': {
    line1: 'Reset: re-align the model.',
    line2: 'One source of truth; consistent patterns.',
  },
  'scalability::reset': {
    line1: 'Reset: stabilize before scaling.',
    line2: 'Make it correct -> then make it fast.',
  },
  'testing::reset': {
    line1: 'Reset: rebuild confidence.',
    line2: 'Add tests; refactor fearlessly.',
  },
  'observability::reset': {
    line1: 'Reset: restore signal.',
    line2: 'Better logs/metrics before more features.',
  },
  'craft::reset': {
    line1: 'Reset: make it delightful.',
    line2: 'Tighten details; remove rough edges.',
  },
}

type PlayVariant = {
  actors?: Play['actors']
  ballSteps?: Play['ball']['steps']
  effects?: Play['effects']
}

function applyVariant(base: Play, variant?: PlayVariant): Play {
  if (!variant) return base
  return {
    ...base,
    actors: variant.actors ?? base.actors,
    ball: variant.ballSteps ? { ...base.ball, steps: variant.ballSteps } : base.ball,
    effects: variant.effects ? { ...(base.effects ?? {}), ...variant.effects } : base.effects,
  }
}

const DRIVE_VARIANTS: Record<PrincipleId, PlayVariant> = {
  clarity: {
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 200 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 420 },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 600, ease: 'easeOut' },
      { kind: 'pulse', durationMs: 200 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 380, ease: 'easeInOut' },
    ],
  },
  architecture: {
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.screen', type: 'O', at: POS.ELBOW_RIGHT, enterAtMs: 120 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 260 },
      { id: 'arrow.boundary', type: 'ARROW', at: { zoneId: A.ARC_TOP }, enterAtMs: 300 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 500 },
      { kind: 'move', to: POS.ELBOW_RIGHT, durationMs: 280, ease: 'easeInOut' },
      { kind: 'pause', durationMs: 140 },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 600, ease: 'easeOut' },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 480, ease: 'easeInOut' },
    ],
  },
  scalability: {
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.spacerLeft', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 120 },
      { id: 'o.spacerRight', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 120 },
      { id: 'o.runner', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 220 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 260 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 520 },
      { kind: 'move', to: POS.MID_LANE, durationMs: 320, ease: 'easeInOut' },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 650, ease: 'easeOut' },
      { kind: 'pause', durationMs: 200 },
      { kind: 'pulse', durationMs: 200 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 500, ease: 'easeInOut' },
    ],
  },
  testing: {
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'x.defender', type: 'X', at: POS.ELBOW_LEFT, enterAtMs: 150 },
      { id: 'x.helper', type: 'X', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 260 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 500 },
      { kind: 'pause', durationMs: 200 },
      { kind: 'move', to: POS.ELBOW_LEFT, durationMs: 280, ease: 'easeInOut' },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 600, ease: 'easeOut' },
      { kind: 'pulse', durationMs: 240 },
      { kind: 'pause', durationMs: 150 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 450, ease: 'easeInOut' },
    ],
  },
  observability: {
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.hotPath', type: 'O', at: { zoneId: A.PAINT }, enterAtMs: 150 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 240 },
      { id: 'cone.sensor', type: 'CONE', at: POS.LANE_TOP_RIGHT, enterAtMs: 260 },
      { id: 'arrow.trace', type: 'ARROW', at: { zoneId: A.ARC_TOP }, enterAtMs: 300 },
    ],
    effects: { rippleAtMs: 420 },
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 480 },
      { kind: 'move', to: { zoneId: A.ARC_TOP }, durationMs: 320, ease: 'easeInOut' },
      { kind: 'pause', durationMs: 120 },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 620, ease: 'easeOut' },
      { kind: 'pulse', durationMs: 220 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 460, ease: 'easeInOut' },
    ],
  },
  craft: {
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.cutter', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 120 },
      { id: 'o.finisher', type: 'O', at: POS.SHORT_CORNER, enterAtMs: 220 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 260 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 480 },
      { kind: 'move', to: { zoneId: A.ARC_LEFT }, durationMs: 300, ease: 'easeInOut' },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 560, ease: 'easeOut' },
      { kind: 'pause', durationMs: 180 },
      { kind: 'pulse', durationMs: 200 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 440, ease: 'easeInOut' },
    ],
  },
}

const KICKOUT_VARIANTS: Record<PrincipleId, PlayVariant> = {
  clarity: {
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 560, ease: 'easeOut' },
      { kind: 'pause', durationMs: 120 },
      {
        kind: 'split',
        branches: [
          { to: { zoneId: A.ARC_LEFT }, durationMs: 500 },
          { to: { zoneId: A.ARC_RIGHT }, durationMs: 500 },
        ],
      },
    ],
  },
  architecture: {
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.hub', type: 'O', at: POS.ELBOW_RIGHT, enterAtMs: 120 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
      { id: 'o.consumerC', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 200 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 420 },
      { kind: 'pause', durationMs: 120 },
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 600, ease: 'easeOut' },
      {
        kind: 'split',
        branches: [
          { to: { zoneId: A.ARC_LEFT }, durationMs: 520 },
          { to: { zoneId: A.ARC_RIGHT }, durationMs: 520 },
          { to: { zoneId: A.ARC_TOP }, durationMs: 700 },
        ],
      },
    ],
  },
  scalability: {
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
      { id: 'o.consumerC', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 200 },
      { id: 'o.consumerD', type: 'O', at: POS.WEAK_WING, enterAtMs: 240 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 650, ease: 'easeOut' },
      {
        kind: 'split',
        branches: [
          { to: { zoneId: A.ARC_LEFT }, durationMs: 520 },
          { to: { zoneId: A.ARC_RIGHT }, durationMs: 520 },
          { to: { zoneId: A.ARC_TOP }, durationMs: 700 },
          { to: POS.WEAK_WING, durationMs: 640 },
        ],
      },
    ],
  },
  testing: {
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
      { id: 'o.consumerC', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 200 },
      { id: 'x.gate', type: 'X', at: POS.MID_LANE, enterAtMs: 220 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 600, ease: 'easeOut' },
      { kind: 'pause', durationMs: 200 },
      { kind: 'pulse', durationMs: 200 },
      {
        kind: 'split',
        branches: [
          { to: { zoneId: A.ARC_LEFT }, durationMs: 540 },
          { to: { zoneId: A.ARC_RIGHT }, durationMs: 540 },
          { to: { zoneId: A.ARC_TOP }, durationMs: 720 },
        ],
      },
    ],
  },
  observability: {
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
      { id: 'o.consumerC', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 200 },
      { id: 'cone.signal', type: 'CONE', at: POS.ELBOW_LEFT, enterAtMs: 220 },
      { id: 'arrow.trace', type: 'ARROW', at: { zoneId: A.ARC_TOP }, enterAtMs: 240 },
    ],
    effects: { rippleAtMs: 500 },
    ballSteps: [
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 620, ease: 'easeOut' },
      { kind: 'pulse', durationMs: 180 },
      {
        kind: 'split',
        branches: [
          { to: { zoneId: A.ARC_LEFT }, durationMs: 520 },
          { to: { zoneId: A.ARC_RIGHT }, durationMs: 520 },
          { to: { zoneId: A.ARC_TOP }, durationMs: 700 },
        ],
      },
    ],
  },
  craft: {
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
      { id: 'o.consumerC', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 200 },
      { id: 'o.cutter', type: 'O', at: POS.SHORT_CORNER, enterAtMs: 220 },
    ],
    ballSteps: [
      { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 620, ease: 'easeOut' },
      { kind: 'pause', durationMs: 140 },
      {
        kind: 'split',
        branches: [
          { to: { zoneId: A.ARC_LEFT }, durationMs: 540, ease: 'easeInOut' },
          { to: { zoneId: A.ARC_RIGHT }, durationMs: 540, ease: 'easeInOut' },
          { to: { zoneId: A.ARC_TOP }, durationMs: 720, ease: 'easeInOut' },
        ],
      },
    ],
  },
}

const RESET_VARIANTS: Record<PrincipleId, PlayVariant> = {
  clarity: {
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 440, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 900 },
    ],
    effects: { rippleAtMs: 420 },
    ballSteps: [
      { kind: 'move', to: POS.LANE_TOP, durationMs: 600, ease: 'easeOut' },
      { kind: 'pulse', durationMs: 200 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 600, ease: 'easeInOut' },
    ],
  },
  architecture: {
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 450, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'x.unknown3', type: 'X', at: { x: 400, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: 'arrow.model', type: 'ARROW', at: { zoneId: A.ARC_TOP }, enterAtMs: 900 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 1100 },
    ],
    effects: { rippleAtMs: 520 },
    ballSteps: [
      { kind: 'move', to: POS.LANE_TOP, durationMs: 650, ease: 'easeOut' },
      { kind: 'pause', durationMs: 200 },
      { kind: 'move', to: POS.LANE_TOP_RIGHT, durationMs: 220, ease: 'easeInOut' },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 650, ease: 'easeInOut' },
    ],
  },
  scalability: {
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 450, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'x.unknown3', type: 'X', at: { x: 400, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: 'x.unknown4', type: 'X', at: POS.LANE_TOP_RIGHT, enterAtMs: 260, exitAtMs: 900 },
      { id: 'x.unknown5', type: 'X', at: POS.LANE_TOP_LEFT, enterAtMs: 320, exitAtMs: 900 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 1100 },
    ],
    effects: { rippleAtMs: 620 },
    ballSteps: [
      { kind: 'move', to: POS.LANE_TOP, durationMs: 700, ease: 'easeOut' },
      { kind: 'pause', durationMs: 260 },
      { kind: 'pulse', durationMs: 220 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 700, ease: 'easeInOut' },
    ],
  },
  testing: {
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 450, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'x.unknown3', type: 'X', at: { x: 400, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: 'cone.check', type: 'CONE', at: POS.LANE_TOP, enterAtMs: 280 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 1100 },
    ],
    effects: { rippleAtMs: 520 },
    ballSteps: [
      { kind: 'move', to: POS.LANE_TOP, durationMs: 650, ease: 'easeOut' },
      { kind: 'pause', durationMs: 200 },
      { kind: 'pulse', durationMs: 200 },
      { kind: 'pause', durationMs: 150 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 650, ease: 'easeInOut' },
    ],
  },
  observability: {
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 450, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'x.unknown3', type: 'X', at: { x: 400, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: 'cone.signal', type: 'CONE', at: POS.LANE_TOP_RIGHT, enterAtMs: 300 },
      { id: 'arrow.trace', type: 'ARROW', at: { zoneId: A.ARC_TOP }, enterAtMs: 900 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 1100 },
    ],
    effects: { rippleAtMs: 380 },
    ballSteps: [
      { kind: 'move', to: POS.LANE_TOP, durationMs: 600, ease: 'easeOut' },
      { kind: 'pulse', durationMs: 220 },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 650, ease: 'easeInOut' },
    ],
  },
  craft: {
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 450, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'x.unknown3', type: 'X', at: { x: 400, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: 'o.polish', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 950 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 1100 },
    ],
    effects: { rippleAtMs: 520 },
    ballSteps: [
      { kind: 'move', to: POS.LANE_TOP, durationMs: 620, ease: 'easeOut' },
      { kind: 'pause', durationMs: 180 },
      { kind: 'pulse', durationMs: 220 },
      { kind: 'move', to: POS.LANE_TOP_LEFT, durationMs: 200, ease: 'easeInOut' },
      { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 620, ease: 'easeInOut' },
    ],
  },
}

function makeDrive(principleId: PrincipleId): Play {
  const base: Play = {
    id: `play.drive.${principleId}`,
    principleId,
    shotId: 'drive',
    title: 'Drive',
    tagline: 'Go directly at the constraint.',
    tooltip: tooltips[`${principleId}::drive`],
    actors: [
      { id: 'o.primary', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.hotPath', type: 'O', at: { zoneId: A.PAINT }, enterAtMs: 150 },
      { id: 'cone.constraint', type: 'CONE', at: { zoneId: A.PAINT }, enterAtMs: 250 },
    ],
    ball: {
      origin: { zoneId: A.PLAYER_START },
      steps: [
        { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 500 },
        { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 650, ease: 'easeOut' },
        { kind: 'pause', durationMs: 250 },
        { kind: 'pulse', durationMs: 250 },
        { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 450, ease: 'easeInOut' },
      ],
    },
  }

  return applyVariant(base, DRIVE_VARIANTS[principleId])
}

function makeKickOut(principleId: PrincipleId): Play {
  const base: Play = {
    id: `play.kickout.${principleId}`,
    principleId,
    shotId: 'kickout',
    title: 'Kick Out',
    tagline: 'Decouple and fan-out safely.',
    tooltip: tooltips[`${principleId}::kickout`],
    actors: [
      { id: 'o.publisher', type: 'O', at: { zoneId: A.TOP_KEY }, enterAtMs: 0 },
      { id: 'o.consumerA', type: 'O', at: { zoneId: A.ARC_LEFT }, enterAtMs: 200 },
      { id: 'o.consumerB', type: 'O', at: { zoneId: A.ARC_RIGHT }, enterAtMs: 200 },
      { id: 'o.consumerC', type: 'O', at: { zoneId: A.ARC_TOP }, enterAtMs: 200 },
    ],
    ball: {
      origin: { zoneId: A.PLAYER_START },
      steps: [
        { kind: 'move', to: { zoneId: A.PAINT }, durationMs: 650, ease: 'easeOut' },
        {
          kind: 'split',
          branches: [
            { to: { zoneId: A.ARC_LEFT }, durationMs: 550 },
            { to: { zoneId: A.ARC_RIGHT }, durationMs: 550 },
            { to: { zoneId: A.ARC_TOP }, durationMs: 750 },
          ],
        },
      ],
    },
  }

  return applyVariant(base, KICKOUT_VARIANTS[principleId])
}

function makeReset(principleId: PrincipleId): Play {
  const base: Play = {
    id: `play.reset.${principleId}`,
    principleId,
    shotId: 'reset',
    title: 'Reset',
    tagline: 'Stabilize and simplify before pushing forward.',
    tooltip: tooltips[`${principleId}::reset`],
    effects: { dimCourt: true, rippleAtMs: 500 },
    actors: [
      { id: 'x.unknown1', type: 'X', at: { x: 420, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: 'x.unknown2', type: 'X', at: { x: 450, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: 'x.unknown3', type: 'X', at: { x: 400, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: 'arrow.clean', type: 'ARROW', at: { zoneId: A.TOP_KEY }, enterAtMs: 1100 },
    ],
    ball: {
      origin: { zoneId: A.PLAYER_START },
      steps: [
        { kind: 'move', to: { x: 430, y: 330 }, durationMs: 650, ease: 'easeOut' },
        { kind: 'pause', durationMs: 250 },
        { kind: 'pulse', durationMs: 250 },
        { kind: 'move', to: { zoneId: A.TOP_KEY }, durationMs: 650, ease: 'easeInOut' },
      ],
    },
  }

  return applyVariant(base, RESET_VARIANTS[principleId])
}

export const plays: PlayRegistry = {
  // Drive
  'clarity::drive': makeDrive('clarity'),
  'architecture::drive': makeDrive('architecture'),
  'scalability::drive': makeDrive('scalability'),
  'testing::drive': makeDrive('testing'),
  'observability::drive': makeDrive('observability'),
  'craft::drive': makeDrive('craft'),

  // Kick Out
  'clarity::kickout': makeKickOut('clarity'),
  'architecture::kickout': makeKickOut('architecture'),
  'scalability::kickout': makeKickOut('scalability'),
  'testing::kickout': makeKickOut('testing'),
  'observability::kickout': makeKickOut('observability'),
  'craft::kickout': makeKickOut('craft'),

  // Reset
  'clarity::reset': makeReset('clarity'),
  'architecture::reset': makeReset('architecture'),
  'scalability::reset': makeReset('scalability'),
  'testing::reset': makeReset('testing'),
  'observability::reset': makeReset('observability'),
  'craft::reset': makeReset('craft'),
}
