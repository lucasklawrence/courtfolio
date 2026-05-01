import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { CardioData } from '@/types/cardio';

/**
 * Server-side equivalent of `getCardioData()` that reads
 * `public/data/cardio.json` directly off disk via `fs/promises`.
 *
 * The browser-facing {@link import('./cardio').getCardioData} uses
 * `fetch(DATA_BASE_URL/...)` which works in the browser but not in a
 * Next.js server component — relative URLs have no base on the server,
 * so the fetch throws `Invalid URL` before reaching the file. Server
 * components (e.g. `app/training-facility/gym/page.tsx` hydrating the
 * wall fixtures at request time) call this function instead.
 *
 * Returns `null` when the file doesn't exist yet — typical pre-baseline
 * state, before `scripts/preprocess-health.py` has produced
 * `cardio.json`. Callers should render an empty / fallback state in
 * that case rather than treating it as an error.
 *
 * `server-only` guards against accidental client imports — Next will
 * compile-error rather than ship `node:fs` to the browser.
 *
 * @throws {Error} on read failures other than `ENOENT`.
 * @throws {SyntaxError} if the file body is not valid JSON.
 */
export async function getCardioDataFromDisk(): Promise<CardioData | null> {
  const filePath = path.join(process.cwd(), 'public', 'data', 'cardio.json');
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
  return JSON.parse(raw) as CardioData;
}
