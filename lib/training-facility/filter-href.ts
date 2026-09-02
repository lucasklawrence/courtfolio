/**
 * Shared href construction for the History view's URL-state controls (#438).
 *
 * The exercise chips and the heatmap range toggle sit next to each other and
 * both encode their state as search params, both carry the *other's* params
 * through, and both spell their default as the param's absence. Written twice
 * they drifted immediately — the second copy went in with a query-only `?…`
 * href that Next's `<Link>` doesn't resolve against the current route, a bug
 * the first copy had already avoided by linking an absolute pathname.
 */

/**
 * Compose a route-relative href from a pathname and a set of params.
 *
 * @param pathname Route to link to, e.g. `/training-facility/weight-room/history`.
 * @param params Params to write. A `null` value **removes** the param, which is
 *   how a default is spelled — it keeps the canonical URL clean and means a
 *   link shared without the param lands where a reader starts.
 * @returns The pathname alone when no params survive, otherwise `path?query`.
 */
export function buildFilterHref(
  pathname: string,
  params: Readonly<Record<string, string | null>>
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) search.set(key, value)
  }
  const query = search.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}
