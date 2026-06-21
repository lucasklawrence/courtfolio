/**
 * Courtfolio-specific evidence specs for the judge panel (#234). Lives in
 * `scripts/` (not the liftable `lib/panel`) because the project list and the
 * file paths to ground against are particular to this repo.
 *
 * Each spec names the real source files whose excerpts let the panel — and the
 * verifier — cite actual code instead of a tagline. Paths are deliberately the
 * ones the terminal prototype's gaps hinged on (the morph, the feature flag,
 * the free-roam sprite, the telemetry client, the coverage gate).
 */
import type { RepoProjectSpec } from '../lib/panel/evidence/repo-evidence'

/** Portfolio projects that can be judged, keyed by slug. */
export const PANEL_PROJECTS: Record<string, RepoProjectSpec> = {
  courtfolio: {
    targetId: 'courtfolio',
    title: 'Courtfolio',
    description:
      'Courtfolio is Lucas Lawrence\'s personal portfolio site, built as a basketball-themed Next.js app: the whole site maps onto a court, with themed "rooms" (Weight Room, Combine, Gym) visualizing his training data through hand-built SVG scenes and Framer Motion. It also carries a telemetry client, a tested CI-gated codebase, and accessible interactions.',
    paths: [
      'app/page.tsx',
      'components/court/CourtSvg.tsx',
      'components/court/FreeRoamPlayer.tsx',
      'components/project-binder/ProjectGallery.tsx',
      'components/project-binder/cardMorph.ts',
      'lib/telemetry/client.ts',
      'lib/feature-flags.ts',
      'vitest.config.ts',
      '.github/workflows/unit.yml',
    ],
  },
}
