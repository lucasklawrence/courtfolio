import type { CardioData } from '@/types/cardio';
import { DATA_BASE_URL } from './config';

export async function getCardioData(): Promise<CardioData> {
  const res = await fetch(`${DATA_BASE_URL}/cardio.json`);
  if (!res.ok) {
    throw new Error(`Failed to load cardio data: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
