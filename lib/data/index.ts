/**
 * Training Facility data-access layer (PRD §7.10).
 *
 * Components MUST go through this module rather than importing JSON files
 * directly. A future migration from static JSON to a hosted API is then a
 * one-line URL change per function — no component, chart, or form changes.
 *
 * Rules:
 *   1. No `import data from '../public/data/*.json'` in components.
 *   2. All writes go through this layer. Today they hit a dev-only Next.js
 *      API route (gated behind `NODE_ENV === 'development'`); tomorrow they
 *      could hit a real backend with the same payload contract.
 *   3. One module per data domain (`cardio`, `movement`, future `sessions`).
 *   4. Types are shared via `@/types/*` — single source of truth across the
 *      Python preprocessor's output, the static JSON, this layer, and any
 *      future API.
 */

export { getCardioData } from './cardio';
export {
  getMovementBenchmarks,
  logBenchmark,
  updateBenchmark,
  deleteBenchmark,
} from './movement';
