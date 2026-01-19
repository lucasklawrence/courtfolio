/**
 * Sample play objects for v1 canonical plays.
 * NOTE: Replace zoneIds with your real court zone IDs.
 */

import type { Play, PlayRegistry } from "./plays.schema";

const Z = {
  // Example anchors (swap to your real ids)
  PLAYER_START: "anchor.playerStart",
  TOP_KEY: "anchor.topKey",
  PAINT: "anchor.paint",
  ARC_LEFT: "anchor.arcLeft",
  ARC_RIGHT: "anchor.arcRight",
  ARC_TOP: "anchor.arcTop",
} as const;

export const plays: PlayRegistry = {
  "scalability::drive": {
    id: "play.drive.scalability",
    principleId: "scalability",
    shotId: "drive",
    title: "Drive",
    tagline: "Go directly at the constraint.",
    tooltip: {
      line1: "Drive: attack the bottleneck.",
      line2: "Profile → narrow → fix → then scale out.",
    },
    actors: [
      { id: "o.api", type: "O", at: { zoneId: Z.TOP_KEY }, enterAtMs: 0 },
      { id: "o.db", type: "O", at: { zoneId: Z.PAINT }, enterAtMs: 150 },
      { id: "cone.bottleneck", type: "CONE", at: { zoneId: Z.PAINT }, enterAtMs: 250 },
    ],
    ball: {
      origin: { zoneId: Z.PLAYER_START },
      steps: [
        { kind: "move", to: { zoneId: Z.TOP_KEY }, durationMs: 500 },
        { kind: "move", to: { zoneId: Z.PAINT }, durationMs: 650, ease: "easeOut" },
        { kind: "pause", durationMs: 250 },
        { kind: "pulse", durationMs: 250 },
        { kind: "move", to: { zoneId: Z.TOP_KEY }, durationMs: 450, ease: "easeInOut" },
      ],
    },
  },

  "architecture::kickout": {
    id: "play.kickout.architecture",
    principleId: "architecture",
    shotId: "kickout",
    title: "Kick Out",
    tagline: "Decouple and fan-out safely.",
    tooltip: {
      line1: "Kick Out: decouple with events.",
      line2: "Fan-out work; accept eventual consistency.",
    },
    actors: [
      { id: "o.publisher", type: "O", at: { zoneId: Z.TOP_KEY }, enterAtMs: 0 },
      { id: "o.consumerA", type: "O", at: { zoneId: Z.ARC_LEFT }, enterAtMs: 200 },
      { id: "o.consumerB", type: "O", at: { zoneId: Z.ARC_RIGHT }, enterAtMs: 200 },
      { id: "o.consumerC", type: "O", at: { zoneId: Z.ARC_TOP }, enterAtMs: 200 },
    ],
    ball: {
      origin: { zoneId: Z.PLAYER_START },
      steps: [
        { kind: "move", to: { zoneId: Z.PAINT }, durationMs: 650, ease: "easeOut" },
        {
          kind: "split",
          branches: [
            { to: { zoneId: Z.ARC_LEFT }, durationMs: 550 },
            { to: { zoneId: Z.ARC_RIGHT }, durationMs: 550 },
            { to: { zoneId: Z.ARC_TOP }, durationMs: 750 }, // slight delay implies async
          ],
        },
      ],
    },
  },

  "testing::reset": {
    id: "play.reset.testing",
    principleId: "testing",
    shotId: "reset",
    title: "Reset",
    tagline: "Stabilize and simplify before pushing forward.",
    tooltip: {
      line1: "Reset: stabilize before scaling.",
      line2: "Add tests + shrink surface area.",
    },
    effects: { dimCourt: true, rippleAtMs: 500 },
    actors: [
      { id: "x.unknown1", type: "X", at: { x: 520, y: 310 }, enterAtMs: 200, exitAtMs: 900 },
      { id: "x.unknown2", type: "X", at: { x: 560, y: 340 }, enterAtMs: 250, exitAtMs: 900 },
      { id: "x.unknown3", type: "X", at: { x: 500, y: 350 }, enterAtMs: 300, exitAtMs: 900 },
      { id: "arrow.clean", type: "ARROW", at: { zoneId: Z.TOP_KEY }, enterAtMs: 1100 },
    ],
    ball: {
      origin: { zoneId: Z.PLAYER_START },
      steps: [
        { kind: "move", to: { x: 540, y: 330 }, durationMs: 650, ease: "easeOut" },
        { kind: "pause", durationMs: 250 },
        { kind: "pulse", durationMs: 250 },
        { kind: "move", to: { zoneId: Z.TOP_KEY }, durationMs: 650, ease: "easeInOut" },
      ],
    },
  },
};
