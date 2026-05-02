/**
 * Pure (non-client, non-hook) helpers for the cardio empty-state
 * preview URL contract (#162). Lives in its own file — *without* a
 * `'use client'` directive — so a Server Component (e.g.
 * `/training-facility/gym/page.tsx`) can import the predicate the
 * same way the client islands do via the hook in
 * `use-cardio-preview.ts`. A `'use client'` file would make every
 * export a client reference, which Next 15+ refuses to call from a
 * Server Component.
 */

/** URL param key + value that activates the empty-state demo fixture. */
export const CARDIO_PREVIEW_PARAM = 'preview'
export const CARDIO_PREVIEW_VALUE = 'demo'

/**
 * Cross-context predicate for "is `?preview=demo` active in this URL?"
 *
 * - **Server components** receive `searchParams` as a Page prop
 *   (`Record<string, string | string[] | undefined>`). A repeated key
 *   like `?preview=demo&preview=other` arrives as an array there.
 * - **Client components** call `useSearchParams().get('preview')`,
 *   which always returns the first value as a string (or `null`).
 *
 * Both shapes need to behave the same: any presence of the literal
 * string `"demo"` activates preview, regardless of whether it's the
 * sole value or one of several. This avoids a class of bug where
 * server and client read the same URL and disagree on whether the
 * page is in preview mode.
 *
 * @param raw The raw value extracted from either source. Pass
 *   `searchParams.preview` on the server or
 *   `searchParams.get('preview')` on the client.
 */
export function isPreviewDemoActive(
  raw: string | string[] | null | undefined,
): boolean {
  if (raw === CARDIO_PREVIEW_VALUE) return true
  if (Array.isArray(raw) && raw.includes(CARDIO_PREVIEW_VALUE)) return true
  return false
}
