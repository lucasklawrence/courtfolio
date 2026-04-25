import type { CardioData } from '@/types/cardio';
import { DATA_BASE_URL } from './config';

/**
 * Fetches the full cardio dataset (`public/data/cardio.json`).
 *
 * Today this is a static asset; a future migration to a hosted API only changes
 * the URL inside this function — callers don't need to know.
 *
 * @throws if the fetch fails or the response status is not OK.
 */
export async function getCardioData(): Promise<CardioData> {
  const res = await fetch(`${DATA_BASE_URL}/cardio.json`);
  if (!res.ok) {
    throw new Error(`Failed to load cardio data: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
