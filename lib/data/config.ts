/**
 * Internal: base URL for static data assets. Defaults to `/data` per PRD §7.13
 * — set `NEXT_PUBLIC_DATA_URL` to swap the source (e.g. point at a CDN or a
 * future API origin) without touching call sites.
 */
const ENV_DATA_URL = process.env.NEXT_PUBLIC_DATA_URL?.trim();

export const DATA_BASE_URL = (ENV_DATA_URL || '/data').replace(/\/$/, '');
