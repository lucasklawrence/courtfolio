import type { CardioData } from '@/types/cardio';
import { DATA_BASE_URL } from './config';

/**
 * Fetches the full cardio dataset (`public/data/cardio.json`).
 *
 * Today this is a static asset; a future migration to a hosted API only changes
 * the URL inside this function — callers don't need to know.
 *
 * Returns `null` if the dataset doesn't exist yet (typical pre-baseline state,
 * before `scripts/preprocess-health.py` has produced `cardio.json`). Callers
 * should render an empty state in that case rather than treating it as an error.
 * `null` rather than an empty array because `CardioData` is an object.
 *
 * @throws on non-404 fetch failures.
 */
export async function getCardioData(): Promise<CardioData | null> {
  const res = await fetch(`${DATA_BASE_URL}/cardio.json`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load cardio data: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
