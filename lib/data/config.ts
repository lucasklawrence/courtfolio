const ENV_DATA_URL = process.env.NEXT_PUBLIC_DATA_URL?.trim();

/**
 * Base URL for static data assets, with any trailing slash stripped.
 *
 * Defaults to `/data` (the on-disk static path) per PRD §7.13. Set
 * `NEXT_PUBLIC_DATA_URL` to swap the source — e.g. a CDN or a future API
 * origin — without touching call sites. Empty/whitespace env values are
 * treated as missing and fall back to the default.
 */
export const DATA_BASE_URL = (ENV_DATA_URL || '/data').replace(/\/$/, '');
